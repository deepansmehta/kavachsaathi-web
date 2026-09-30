import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import {
  PROFILE_SESSION_COOKIE,
  verifyProfileSessionToken,
} from "@/lib/profileSession";
import {
  formatAbhaId,
  isValidAbhaId,
  normalizeAbhaId,
  parseCriticalAlerts,
  parseOrganDonor,
} from "@/lib/profileFields";

/** PATCH /api/profile/update — edit own profile (session required) */
export async function PATCH(req: NextRequest) {
  try {
    const token = cookies().get(PROFILE_SESSION_COOKIE)?.value;
    const session = verifyProfileSessionToken(token);
    if (!session) {
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }

    const body = await req.json();
    const db = getAdminDb();
    const ref = db.collection("profiles").doc(session.profileId);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const patch: Record<string, unknown> = {
      updated_at: FieldValue.serverTimestamp(),
    };

    if (body.full_name !== undefined) {
      const n = String(body.full_name).trim();
      if (n.length < 2) {
        return NextResponse.json({ error: "Invalid name" }, { status: 400 });
      }
      patch.full_name = n;
    }
    if (body.blood_group !== undefined) {
      patch.blood_group = String(body.blood_group).trim();
    }
    if (body.city !== undefined) {
      const city = String(body.city).trim();
      if (city.length < 2) {
        return NextResponse.json({ error: "City is required" }, { status: 400 });
      }
      patch.city = city;
    }
    if (body.fullAddress !== undefined) {
      patch.fullAddress = String(body.fullAddress || "").trim() || null;
    }
    if (body.organDonor !== undefined) {
      patch.organDonor = parseOrganDonor(body.organDonor);
    }
    if (body.preferredHospital !== undefined) {
      patch.preferredHospital =
        String(body.preferredHospital || "").trim() || null;
    }
    if (body.criticalAlerts !== undefined) {
      patch.criticalAlerts = parseCriticalAlerts(body.criticalAlerts);
    }
    if (body.abhaId !== undefined) {
      if (!isValidAbhaId(body.abhaId)) {
        return NextResponse.json(
          { error: "ABHA ID must be 14 digits (hyphens optional)" },
          { status: 400 }
        );
      }
      const digits = normalizeAbhaId(body.abhaId);
      patch.abhaId = digits ? formatAbhaId(digits) : null;
    }
    if (body.allergies !== undefined) patch.allergies = asArr(body.allergies);
    if (body.chronic_conditions !== undefined) {
      patch.chronic_conditions = asArr(body.chronic_conditions);
    }
    if (body.medications !== undefined) {
      patch.medications = asArr(body.medications);
    }
    if (body.emergency_contacts !== undefined) {
      const contacts = (Array.isArray(body.emergency_contacts)
        ? body.emergency_contacts
        : []
      )
        .map((c: { name?: string; phone?: string; relation?: string }) => ({
          name: String(c.name || "").trim(),
          phone: String(c.phone || "")
            .replace(/\D/g, "")
            .slice(-10),
          relation: c.relation ? String(c.relation) : undefined,
        }))
        .filter(
          (c: { name: string; phone: string }) =>
            c.name && /^[6-9]\d{9}$/.test(c.phone)
        );
      if (contacts.length < 1 || contacts.length > 3) {
        return NextResponse.json(
          { error: "Need 1–3 valid emergency contacts" },
          { status: 400 }
        );
      }
      patch.emergency_contacts = contacts;
    }

    const doctorName =
      body.familyDoctorName !== undefined
        ? String(body.familyDoctorName || "").trim()
        : body.family_doctor?.name !== undefined
          ? String(body.family_doctor.name || "").trim()
          : undefined;
    const doctorPhone =
      body.familyDoctorPhone !== undefined
        ? String(body.familyDoctorPhone || "")
            .replace(/\D/g, "")
            .slice(-10)
        : body.family_doctor?.phone !== undefined
          ? String(body.family_doctor.phone || "")
              .replace(/\D/g, "")
              .slice(-10)
          : undefined;

    if (doctorName !== undefined || doctorPhone !== undefined) {
      const existing = snap.data()?.family_doctor || {};
      const name =
        doctorName !== undefined
          ? doctorName
          : String(existing.name || "").trim();
      const phone =
        doctorPhone !== undefined
          ? doctorPhone
          : String(existing.phone || "").replace(/\D/g, "").slice(-10);
      patch.family_doctor = { name, phone };
      patch.familyDoctorName = name || null;
      patch.familyDoctorPhone = phone || null;
    }

    if (body.photo_url !== undefined) {
      patch.photo_url = body.photo_url ? String(body.photo_url) : null;
    }
    // Never allow pin_hash / activation_code / health_id / phone via this route

    await ref.update(patch);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("profile/update", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Update failed" },
      { status: 500 }
    );
  }
}

function asArr(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x).trim()).filter(Boolean);
}
