import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";

/**
 * POST /api/auth/activate
 * Body: { activationCode, phone, pinHash, healthProfile }
 * 1. Card exists + status available|unactivated
 * 2. Phone not already used
 * 3. createUser → uid
 * 4. users/{uid}.set(profile + pin_hash)
 * 5. card → active + user_uid
 * 6. return { customToken, healthId }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Support both prompt shape and existing frontend shape
    const activationCode = String(
      body.activationCode ?? body.activation_code ?? ""
    )
      .trim()
      .padStart(4, "0");
    const phoneRaw = String(body.phone ?? "");
    const pinHash = String(body.pinHash ?? "");
    const healthProfile =
      (body.healthProfile as Record<string, unknown> | undefined) ??
      (body.profile as Record<string, unknown> | undefined);

    if (!activationCode || !phoneRaw || !pinHash || !healthProfile) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const phone = phoneRaw.replace(/\D/g, "").slice(-10);
    if (!/^[6-9]\d{9}$/.test(phone)) {
      return NextResponse.json({ error: "Invalid phone" }, { status: 400 });
    }
    if (pinHash.length !== 64 || !/^[a-f0-9]+$/i.test(pinHash)) {
      return NextResponse.json({ error: "Invalid pin hash" }, { status: 400 });
    }
    if (!/^\d{4}$/.test(activationCode)) {
      return NextResponse.json(
        { error: "Activation code must be 4 digits (0001–0100)" },
        { status: 400 }
      );
    }

    const db = getAdminDb();
    const cardRef = db.collection("cards").doc(activationCode);
    const cardSnap = await cardRef.get();

    if (!cardSnap.exists) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    const card = cardSnap.data()!;
    // Prompt: "available" | seeded legacy: "unactivated"
    const isAvailable =
      card.status === "available" || card.status === "unactivated";
    if (!isAvailable) {
      return NextResponse.json(
        { error: "This card has already been activated" },
        { status: 409 }
      );
    }

    const existingPhone = await db
      .collection("users")
      .where("phone", "==", phone)
      .limit(1)
      .get();
    if (!existingPhone.empty) {
      return NextResponse.json(
        { error: "This phone is already registered. Please login." },
        { status: 409 }
      );
    }

    const auth = getAdminAuth();
    const userRecord = await auth.createUser({
      phoneNumber: `+91${phone}`,
      displayName: String(healthProfile.full_name || ""),
    });

    const healthId =
      (card.health_id as string) ||
      `KVS-2026-${activationCode.padStart(5, "0")}`;

    // Normalize emergency contacts (array schema + legacy contact_1/2)
    let emergency_contacts = healthProfile.emergency_contacts;
    if (!Array.isArray(emergency_contacts)) {
      const c1 = healthProfile.emergency_contact_1 as
        | { name?: string; phone?: string; relation?: string }
        | undefined;
      const c2 = healthProfile.emergency_contact_2 as
        | { name?: string; phone?: string; relation?: string }
        | undefined;
      emergency_contacts = [c1, c2].filter(
        (c) => c && (c.name || c.phone)
      ) as { name: string; phone: string; relation: string }[];
    }

    const userData = {
      ...healthProfile,
      uid: userRecord.uid,
      health_id: healthId,
      phone,
      pin_hash: pinHash,
      activation_code: activationCode,
      emergency_contacts,
      allergies: Array.isArray(healthProfile.allergies)
        ? healthProfile.allergies
        : [],
      medical_conditions: Array.isArray(healthProfile.medical_conditions)
        ? healthProfile.medical_conditions
        : [],
      doctor_name: String(healthProfile.doctor_name || ""),
      doctor_phone: String(healthProfile.doctor_phone || ""),
      insurance_number: String(healthProfile.insurance_number || "").trim(),
      reset_token: null,
      reset_token_expires: null,
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    };

    await db.collection("users").doc(userRecord.uid).set(userData);

    await cardRef.update({
      status: "active",
      user_uid: userRecord.uid,
      health_id: healthId,
      activated_at: FieldValue.serverTimestamp(),
    });

    const customToken = await auth.createCustomToken(userRecord.uid);

    return NextResponse.json({
      success: true,
      customToken,
      healthId,
      health_id: healthId, // legacy alias for existing activate UI
      uid: userRecord.uid,
    });
  } catch (err) {
    console.error("activate error", err);
    const message = err instanceof Error ? err.message : "Activation failed";
    if (message.includes("phone number already exists")) {
      return NextResponse.json(
        { error: "This phone is already registered. Please login." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
