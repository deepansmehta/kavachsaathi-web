import { NextRequest, NextResponse } from "next/server";
import { requireFeature } from "@/lib/features/server";
import { requireAdminUser } from "@/lib/adminAuth";
import { getAdminDb } from "@/lib/firebase-admin";
import { findCardByHealthId } from "@/lib/cardsRepo";
import { buildVehicleStickerPrintPng } from "@/lib/vehicleStickerPrint";
import { STICKER_PRINTABLE_STATUSES } from "@/lib/stickerOrders";
import { FieldValue } from "firebase-admin/firestore";
import { noStoreHeaders } from "@/lib/forms/pdfCommon";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET — admin print file for a confirmed+ order. */
export async function GET(
  req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  const feature = await requireFeature("vehicleSticker");
  if (!feature) {
    return NextResponse.json(
      { error: "Feature not available", code: "FEATURE_OFF" },
      { status: 404, headers: noStoreHeaders() }
    );
  }
  const admin = await requireAdminUser(req);
  if (admin instanceof NextResponse) return admin;

  const orderId = String(params.orderId || "").trim();
  if (!orderId) {
    return NextResponse.json({ error: "Missing orderId" }, { status: 400 });
  }

  const db = getAdminDb();
  const snap = await db.collection("stickerOrders").doc(orderId).get();
  if (!snap.exists) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const o = snap.data()!;
  const status = String(o.status || "");
  if (
    !(STICKER_PRINTABLE_STATUSES as readonly string[]).includes(status)
  ) {
    return NextResponse.json(
      { error: "Print available only after order is confirmed" },
      { status: 403, headers: noStoreHeaders() }
    );
  }

  const health_id = String(o.health_id || "").toUpperCase();
  const card = await findCardByHealthId(db, health_id);
  let bloodGroup = "—";
  if (card?.linkedProfileId) {
    const p = await db.collection("profiles").doc(card.linkedProfileId).get();
    if (p.exists) bloodGroup = String(p.data()?.blood_group || "—");
  }

  const png = await buildVehicleStickerPrintPng({ healthId: health_id, bloodGroup });

  await db.collection("accessLogs").add({
    mode: "admin",
    action: "sticker_print_download",
    orderId,
    healthId: health_id,
    adminEmail: admin.email,
    at: FieldValue.serverTimestamp(),
  });

  return new NextResponse(new Uint8Array(png), {
    status: 200,
    headers: {
      ...noStoreHeaders(),
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="sticker-${health_id}.png"`,
    },
  });
}
