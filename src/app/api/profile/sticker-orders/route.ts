import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireFeature } from "@/lib/features/server";
import {
  PROFILE_SESSION_COOKIE,
  verifyProfileSessionToken,
} from "@/lib/profileSession";
import { getAdminDb } from "@/lib/firebase-admin";
import { encrypt, hasEncKey } from "@/lib/crypto";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import { noStoreHeaders } from "@/lib/forms/pdfCommon";
import {
  STICKER_OPEN_STATUSES,
  isVehicleType,
} from "@/lib/stickerOrders";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function headers() {
  return noStoreHeaders();
}

async function sessionProfile(req: NextRequest) {
  const tok = req.cookies.get(PROFILE_SESSION_COOKIE)?.value;
  const sess = verifyProfileSessionToken(tok);
  if (!sess) return null;
  const db = getAdminDb();
  const snap = await db.collection("profiles").doc(sess.profileId).get();
  if (!snap.exists) return null;
  return { db, snap, profileId: sess.profileId };
}

/** GET — list owner's sticker orders (address omitted; phone + vehicle fields only). */
export async function GET(req: NextRequest) {
  const feature = await requireFeature("vehicleSticker");
  if (!feature) {
    return NextResponse.json(
      { error: "Feature not available", code: "FEATURE_OFF" },
      { status: 404, headers: headers() }
    );
  }
  const ctx = await sessionProfile(req);
  if (!ctx) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: headers() }
    );
  }
  const health_id = String(ctx.snap.data()?.health_id || "").toUpperCase();
  const q = await ctx.db
    .collection("stickerOrders")
    .where("health_id", "==", health_id)
    .orderBy("createdAt", "desc")
    .limit(20)
    .get();
  const orders = q.docs.map((d) => {
    const x = d.data();
    return {
      id: d.id,
      health_id: x.health_id,
      vehicleNumber: x.vehicleNumber,
      vehicleType: x.vehicleType,
      qty: x.qty,
      phone: x.phone,
      status: x.status,
      createdAt: x.createdAt,
      updatedAt: x.updatedAt,
    };
  });
  return NextResponse.json({ orders }, { headers: headers() });
}

/** POST — place a car sticker order. */
export async function POST(req: NextRequest) {
  const feature = await requireFeature("vehicleSticker");
  if (!feature) {
    return NextResponse.json(
      { error: "Feature not available", code: "FEATURE_OFF" },
      { status: 404, headers: headers() }
    );
  }
  if (!hasEncKey()) {
    return NextResponse.json(
      { error: "Encryption not configured" },
      { status: 503, headers: headers() }
    );
  }
  const ctx = await sessionProfile(req);
  if (!ctx) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: headers() }
    );
  }

  const body = await req.json().catch(() => ({}));
  const vehicleNumber = String(body.vehicleNumber || "")
    .trim()
    .toUpperCase()
    .slice(0, 20);
  const vehicleType = String(body.vehicleType || "").trim();
  const qty = Number(body.qty);
  const address = String(body.address || "").trim().slice(0, 500);
  const phone = String(body.phone || "")
    .replace(/\D/g, "")
    .slice(0, 15);

  if (!vehicleNumber || !isVehicleType(vehicleType)) {
    return NextResponse.json(
      { error: "Vehicle number and type (car/bike/other) required" },
      { status: 400, headers: headers() }
    );
  }
  if (!Number.isFinite(qty) || qty < 1 || qty > 3) {
    return NextResponse.json(
      { error: "Quantity must be 1–3" },
      { status: 400, headers: headers() }
    );
  }
  if (!address || address.length < 10) {
    return NextResponse.json(
      { error: "Delivery address required" },
      { status: 400, headers: headers() }
    );
  }
  if (phone.length < 10) {
    return NextResponse.json(
      { error: "Valid phone required" },
      { status: 400, headers: headers() }
    );
  }

  const health_id = String(ctx.snap.data()?.health_id || "").toUpperCase();
  const db = ctx.db;

  const rl = await checkRateLimit({
    db,
    key: `sticker_order:${health_id}:${clientIp(req)}`,
    limit: 5,
    windowMs: 60 * 60 * 1000,
    captchaAfter: 5,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many orders. Try again later.", retryAfterSec: rl.retryAfterSec },
      { status: 429, headers: headers() }
    );
  }

  const openSnap = await db
    .collection("stickerOrders")
    .where("health_id", "==", health_id)
    .where("status", "in", STICKER_OPEN_STATUSES)
    .get();
  if (openSnap.size >= 3) {
    return NextResponse.json(
      { error: "Maximum 3 open sticker orders per card" },
      { status: 409, headers: headers() }
    );
  }

  const now = new Date().toISOString();
  const ref = await db.collection("stickerOrders").add({
    health_id,
    vehicleNumber,
    vehicleType,
    qty,
    addressEnc: encrypt(address),
    phone,
    status: "requested",
    adminNote: "",
    createdAt: now,
    updatedAt: now,
    createdAtTs: FieldValue.serverTimestamp(),
    updatedAtTs: FieldValue.serverTimestamp(),
  });

  return NextResponse.json(
    {
      ok: true,
      orderId: ref.id,
      messageEn:
        "Order received. Our team will call you to confirm.",
      messageHi: "ऑर्डर मिल गया, हमारी टीम आपको कॉल करेगी।",
    },
    { status: 201, headers: headers() }
  );
}
