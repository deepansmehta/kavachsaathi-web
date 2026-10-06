import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireFeature } from "@/lib/features/server";
import { requireAdminUser, writeAdminLog } from "@/lib/adminAuth";
import { cookies } from "next/headers";
import {
  PROFILE_SESSION_COOKIE,
  } from "@/lib/profileSession";
import { findCardByHealthId } from "@/lib/cardsRepo";
import { verifyPin } from "@/lib/pin";
import { normalizeHealthId, isValidHealthId } from "@/lib/healthId";
import { firstNameOnly } from "@/lib/validity";
import { NO_STORE_HEADERS } from "@/lib/activationGate";
import { getSignedGetUrl, isStorageConfigured } from "@/lib/storage";

export const dynamic = "force-dynamic";

function vehicleHealthId(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  const buf = randomBytes(5);
  for (let i = 0; i < 5; i++) s += alphabet[buf[i] % alphabet.length];
  return `KVS-V26-${s}`;
}

function activationCode(): string {
  return String(1000 + (randomBytes(2).readUInt16BE(0) % 9000));
}

/** POST /api/admin/vehicle-batch — F50 dry-run by default */
export async function POST(req: NextRequest) {
  const feature = await requireFeature("vehicleSticker");
  if (!feature) {
    return NextResponse.json(
      { error: "Feature not available", code: "FEATURE_OFF" },
      { status: 404, headers: NO_STORE_HEADERS }
    );
  }
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "batch");

  if (action === "batch") {
    const admin = await requireAdminUser(req);
    if (admin instanceof NextResponse) return admin;
    const count = Math.min(50, Math.max(1, Number(body.count || 5)));
    const dryRun = body.dryRun !== false;
    const batch = Number(body.batch || Date.now());
    const samples: { health_id: string; activation_code: string }[] = [];
    const db = getAdminDb();
    for (let i = 0; i < count; i++) {
      const health_id = vehicleHealthId();
      const activation_code = activationCode();
      samples.push({ health_id, activation_code });
      if (!dryRun) {
        await db.collection("cards").doc(health_id).set({
          health_id,
          activation_code,
          status: "unactivated",
          isVehicle: true,
          cardType: "VEHICLE",
          batch,
          serial: `V${String(i + 1).padStart(4, "0")}`,
          created_at: new Date().toISOString(),
        });
      }
    }
    if (!dryRun) {
      await writeAdminLog(db, {
        action: "vehicle_batch_create",
        byEmail: admin.email,
        meta: { count, batch },
      });
    }
    return NextResponse.json(
      { dryRun, count, batch, samples },
      { headers: NO_STORE_HEADERS }
    );
  }

  if (action === "link") {
    // Vehicle owner links 1–3 profiles with each PIN
    const token = cookies().get(PROFILE_SESSION_COOKIE)?.value;
    // Also allow activation-session style: body.vehicleHealthId + links
    const vehicleId = normalizeHealthId(String(body.vehicleHealthId || ""));
    const links = Array.isArray(body.links) ? body.links : [];
    if (!isValidHealthId(vehicleId) || links.length < 1 || links.length > 3) {
      return NextResponse.json(
        { error: "Provide vehicleHealthId and 1–3 links" },
        { status: 400 }
      );
    }
    const db = getAdminDb();
    const vehicle = await findCardByHealthId(db, vehicleId);
    if (!vehicle || vehicle.isDemo) {
      // isDemo check — vehicle cards shouldn't be demo; also reject missing
    }
    if (!vehicle) {
      return NextResponse.json({ error: "Vehicle card not found" }, { status: 404 });
    }
    const vdata = (
      await db.collection("cards").doc(vehicle.docId).get()
    ).data();
    if (!vdata?.isVehicle) {
      return NextResponse.json(
        { error: "Not a vehicle sticker card" },
        { status: 400 }
      );
    }

    const resolved: {
      health_id: string;
      profileId: string;
      firstName: string;
    }[] = [];
    for (const L of links) {
      const hid = normalizeHealthId(String(L.health_id || ""));
      const pin = String(L.pin || "");
      const card = await findCardByHealthId(db, hid);
      if (!card?.linkedProfileId) {
        return NextResponse.json(
          { error: `Card ${hid} not activated` },
          { status: 400 }
        );
      }
      const p = await db.collection("profiles").doc(card.linkedProfileId).get();
      if (!p.exists) {
        return NextResponse.json({ error: "Profile missing" }, { status: 400 });
      }
      if (!(await verifyPin(pin, String(p.data()?.pin_hash || "")))) {
        return NextResponse.json(
          { error: `Incorrect PIN for ${hid}` },
          { status: 403 }
        );
      }
      resolved.push({
        health_id: hid,
        profileId: p.id,
        firstName: firstNameOnly(String(p.data()?.full_name || "")),
      });
    }

    const label = String(body.vehicleLabel || "").slice(0, 80) || null;
    const reg = String(body.registrationNumber || "").trim().slice(0, 20);
    await db
      .collection("cards")
      .doc(vehicle.docId)
      .set(
        {
          status: "activated",
          isVehicle: true,
          vehicleLabel: label,
          // registration never exposed publicly — store only if provided
          vehicleRegPrivate: reg || null,
          linkedRiders: resolved.map((r) => ({
            health_id: r.health_id,
            profileId: r.profileId,
          })),
          activated_at: new Date().toISOString(),
          linkedProfileId: resolved[0]?.profileId || null,
        },
        { merge: true }
      );
    void token;
    return NextResponse.json(
      { ok: true, riders: resolved.length },
      { headers: NO_STORE_HEADERS }
    );
  }

  if (action === "public") {
    // Internal helper used by page — actually page loads from firestore server-side
    return NextResponse.json({ error: "Use card page" }, { status: 400 });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

/** GET riders for vehicle card (server components prefer direct db; this is for client) */
export async function GET(req: NextRequest) {
  const feature = await requireFeature("vehicleSticker");
  if (!feature) {
    return NextResponse.json(
      { error: "Feature not available", code: "FEATURE_OFF" },
      { status: 404, headers: NO_STORE_HEADERS }
    );
  }
  const hid = normalizeHealthId(
    String(req.nextUrl.searchParams.get("health_id") || "")
  );
  const db = getAdminDb();
  const card = await findCardByHealthId(db, hid);
  if (!card) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const data = (await db.collection("cards").doc(card.docId).get()).data();
  if (!data?.isVehicle) {
    return NextResponse.json({ error: "Not a vehicle card" }, { status: 400 });
  }
  const riders = [];
  for (const r of data.linkedRiders || []) {
    const p = await db.collection("profiles").doc(String(r.profileId)).get();
    if (!p.exists) continue;
    const pd = p.data()!;
    let photo: string | null = null;
    const path =
      (pd.photo as { path?: string } | undefined)?.path || pd.photo_url;
    if (
      isStorageConfigured() &&
      typeof path === "string" &&
      path.includes("/") &&
      !path.startsWith("http")
    ) {
      photo = await getSignedGetUrl({ path, expiresMs: 5 * 60_000 });
    } else if (typeof path === "string" && path.startsWith("http")) {
      photo = path;
    }
    riders.push({
      health_id: r.health_id,
      firstName: firstNameOnly(String(pd.full_name || "")),
      photo,
    });
  }
  return NextResponse.json(
    {
      vehicleLabel: data.vehicleLabel || null,
      // registrationNumber intentionally omitted
      riders,
    },
    { headers: NO_STORE_HEADERS }
  );
}
