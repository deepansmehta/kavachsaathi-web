import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdminUser } from "@/lib/adminAuth";
import { decrypt, hasEncKey } from "@/lib/crypto";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/launchReveal";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function tsToIso(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === "object" && v !== null && "toDate" in v) {
    try {
      return (v as { toDate: () => Date }).toDate().toISOString();
    } catch {
      return null;
    }
  }
  return null;
}

/** GET /api/admin/orders — list + optional CSV (no decrypted address). */
export async function GET(req: NextRequest) {
  const admin = await requireAdminUser(req);
  if (admin instanceof NextResponse) return admin;

  const status = String(req.nextUrl.searchParams.get("status") || "").trim();
  const csv = req.nextUrl.searchParams.get("csv") === "1";
  const db = getAdminDb();
  let q = db.collection("orders").orderBy("createdAt", "desc").limit(200);
  if (status && (ORDER_STATUSES as readonly string[]).includes(status)) {
    q = db
      .collection("orders")
      .where("status", "==", status)
      .orderBy("createdAt", "desc")
      .limit(200);
  }
  const snap = await q.get();
  const rows = snap.docs.map((d) => {
    const x = d.data();
    return {
      id: d.id,
      orderNo: String(x.orderNo || d.id),
      pack: String(x.pack || ""),
      cards: String(x.cards || ""),
      qty: Number(x.qty || 1),
      amount: Number(x.amount || 0),
      name: String(x.name || ""),
      phone: String(x.phone || ""),
      status: String(x.status || "requested"),
      notes: String(x.notes || ""),
      createdAt: tsToIso(x.createdAt),
      updatedAt: tsToIso(x.updatedAt),
    };
  });

  if (csv) {
    const header = [
      "orderNo",
      "pack",
      "cards",
      "qty",
      "amount",
      "name",
      "phone",
      "status",
      "notes",
      "createdAt",
    ];
    const lines = [
      header.join(","),
      ...rows.map((r) =>
        [
          r.orderNo,
          JSON.stringify(r.pack),
          JSON.stringify(r.cards),
          r.qty,
          r.amount,
          JSON.stringify(r.name),
          r.phone,
          r.status,
          JSON.stringify(r.notes),
          r.createdAt || "",
        ].join(",")
      ),
    ];
    return new NextResponse(lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="kavach-orders.csv"',
        "Cache-Control": "no-store",
      },
    });
  }

  return NextResponse.json({ orders: rows });
}

/** PATCH /api/admin/orders — update status / notes; optional decrypt for admin UI. */
export async function PATCH(req: NextRequest) {
  const admin = await requireAdminUser(req);
  if (admin instanceof NextResponse) return admin;

  const body = (await req.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  const id = String(body.id || body.orderNo || "").trim();
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  const db = getAdminDb();
  const ref = db.collection("orders").doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (body.decryptAddress === true && hasEncKey()) {
    const enc = String(snap.data()?.addressEnc || "");
    let address = "";
    try {
      address = enc ? decrypt(enc) : "";
    } catch {
      address = "";
    }
    return NextResponse.json({ ok: true, address });
  }

  const patch: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (body.status != null) {
    const st = String(body.status);
    if (!(ORDER_STATUSES as readonly string[]).includes(st)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    patch.status = st as OrderStatus;
  }
  if (body.notes != null) {
    patch.notes = String(body.notes).slice(0, 2000);
  }
  await ref.set(patch, { merge: true });
  return NextResponse.json({ ok: true });
}
