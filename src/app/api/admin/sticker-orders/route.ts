import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireFeature } from "@/lib/features/server";
import { requireAdminUser } from "@/lib/adminAuth";
import { getAdminDb } from "@/lib/firebase-admin";
import { decrypt, hasEncKey } from "@/lib/crypto";
import { noStoreHeaders } from "@/lib/forms/pdfCommon";
import {
  isStickerOrderStatus,
  STICKER_ORDER_STATUSES,
} from "@/lib/stickerOrders";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function headers() {
  return noStoreHeaders();
}

/** GET — list sticker orders (optional ?status=). */
export async function GET(req: NextRequest) {
  const feature = await requireFeature("vehicleSticker");
  if (!feature) {
    return NextResponse.json(
      { error: "Feature not available", code: "FEATURE_OFF" },
      { status: 404, headers: headers() }
    );
  }
  const admin = await requireAdminUser(req);
  if (admin instanceof NextResponse) return admin;

  const statusFilter = String(
    req.nextUrl.searchParams.get("status") || ""
  ).trim();
  const db = getAdminDb();
  let q = db.collection("stickerOrders").orderBy("createdAt", "desc").limit(200);
  if (statusFilter && isStickerOrderStatus(statusFilter)) {
    q = db
      .collection("stickerOrders")
      .where("status", "==", statusFilter)
      .orderBy("createdAt", "desc")
      .limit(200);
  }
  const snap = await q.get();
  const orders = snap.docs.map((d) => {
    const x = d.data();
    let address = "";
    if (hasEncKey() && x.addressEnc) {
      try {
        address = decrypt(String(x.addressEnc));
      } catch {
        address = "";
      }
    }
    return {
      id: d.id,
      health_id: x.health_id,
      vehicleNumber: x.vehicleNumber,
      vehicleType: x.vehicleType,
      qty: x.qty,
      phone: x.phone,
      status: x.status,
      adminNote: x.adminNote || "",
      address,
      createdAt: x.createdAt,
      updatedAt: x.updatedAt,
    };
  });

  return NextResponse.json(
    { orders, statuses: STICKER_ORDER_STATUSES },
    { headers: headers() }
  );
}

/** PATCH — update status and/or adminNote. */
export async function PATCH(req: NextRequest) {
  const feature = await requireFeature("vehicleSticker");
  if (!feature) {
    return NextResponse.json(
      { error: "Feature not available", code: "FEATURE_OFF" },
      { status: 404, headers: headers() }
    );
  }
  const admin = await requireAdminUser(req);
  if (admin instanceof NextResponse) return admin;

  const body = await req.json().catch(() => ({}));
  const orderId = String(body.orderId || "").trim();
  if (!orderId) {
    return NextResponse.json(
      { error: "orderId required" },
      { status: 400, headers: headers() }
    );
  }

  const patch: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
    updatedAtTs: FieldValue.serverTimestamp(),
  };
  if (body.status !== undefined) {
    const st = String(body.status);
    if (!isStickerOrderStatus(st)) {
      return NextResponse.json(
        { error: "Invalid status" },
        { status: 400, headers: headers() }
      );
    }
    patch.status = st;
  }
  if (body.adminNote !== undefined) {
    patch.adminNote = String(body.adminNote || "").slice(0, 2000);
  }

  const db = getAdminDb();
  const ref = db.collection("stickerOrders").doc(orderId);
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: headers() });
  }
  await ref.update(patch);
  return NextResponse.json({ ok: true }, { headers: headers() });
}

/** GET ?export=csv — CSV without address column. */
export async function POST(req: NextRequest) {
  const feature = await requireFeature("vehicleSticker");
  if (!feature) {
    return NextResponse.json(
      { error: "Feature not available", code: "FEATURE_OFF" },
      { status: 404, headers: headers() }
    );
  }
  const admin = await requireAdminUser(req);
  if (admin instanceof NextResponse) return admin;

  const body = await req.json().catch(() => ({}));
  if (String(body.action) !== "exportCsv") {
    return NextResponse.json({ error: "Unknown action" }, { status: 400, headers: headers() });
  }

  const db = getAdminDb();
  const snap = await db
    .collection("stickerOrders")
    .orderBy("createdAt", "desc")
    .limit(500)
    .get();
  const esc = (v: string) =>
    `"${String(v || "").replace(/"/g, '""')}"`;
  const lines = [
    [
      "orderId",
      "health_id",
      "vehicleNumber",
      "vehicleType",
      "qty",
      "phone",
      "status",
      "createdAt",
      "updatedAt",
      "adminNote",
    ].join(","),
  ];
  for (const d of snap.docs) {
    const x = d.data();
    lines.push(
      [
        esc(d.id),
        esc(String(x.health_id)),
        esc(String(x.vehicleNumber)),
        esc(String(x.vehicleType)),
        String(x.qty ?? ""),
        esc(String(x.phone)),
        esc(String(x.status)),
        esc(String(x.createdAt)),
        esc(String(x.updatedAt)),
        esc(String(x.adminNote || "")),
      ].join(",")
    );
  }
  const csv = lines.join("\n");
  return new NextResponse(csv, {
    status: 200,
    headers: {
      ...headers(),
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="sticker-orders.csv"',
    },
  });
}
