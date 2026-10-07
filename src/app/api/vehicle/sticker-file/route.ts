import { NextRequest, NextResponse } from "next/server";
import { requireFeature } from "@/lib/features/server";
import { requireAdminUser } from "@/lib/adminAuth";
import { getAdminDb } from "@/lib/firebase-admin";
import { findCardByHealthId } from "@/lib/cardsRepo";
import { buildVehicleStickerPrintPng } from "@/lib/vehicleStickerPrint";
import { normalizeHealthId, isValidHealthId } from "@/lib/healthId";
import { noStoreHeaders } from "@/lib/forms/pdfCommon";
import { FieldValue } from "firebase-admin/firestore";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Legacy user-facing sticker download — admin session only (403 otherwise).
 * Prefer /api/admin/sticker-orders/{id}/print for order-based fulfilment.
 */
export async function GET(req: NextRequest) {
  const feature = await requireFeature("vehicleSticker");
  if (!feature) {
    return NextResponse.json(
      { error: "Feature not available", code: "FEATURE_OFF" },
      { status: 404, headers: noStoreHeaders() }
    );
  }

  const admin = await requireAdminUser(req);
  if (admin instanceof NextResponse) {
    return NextResponse.json(
      { error: "Forbidden", code: "ADMIN_ONLY" },
      { status: 403, headers: noStoreHeaders() }
    );
  }

  const hid = normalizeHealthId(
    String(req.nextUrl.searchParams.get("health_id") || "")
  );
  if (!isValidHealthId(hid)) {
    return NextResponse.json({ error: "Invalid health_id" }, { status: 400 });
  }

  const db = getAdminDb();
  const card = await findCardByHealthId(db, hid);
  let bloodGroup = "—";
  if (card?.linkedProfileId) {
    const p = await db.collection("profiles").doc(card.linkedProfileId).get();
    if (p.exists) bloodGroup = String(p.data()?.blood_group || "—");
  }

  const png = await buildVehicleStickerPrintPng({ healthId: hid, bloodGroup });

  await db.collection("accessLogs").add({
    mode: "admin",
    action: "sticker_file_legacy",
    healthId: hid,
    adminEmail: admin.email,
    at: FieldValue.serverTimestamp(),
  });

  return new NextResponse(new Uint8Array(png), {
    status: 200,
    headers: {
      ...noStoreHeaders(),
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="sticker-${hid}.png"`,
    },
  });
}
