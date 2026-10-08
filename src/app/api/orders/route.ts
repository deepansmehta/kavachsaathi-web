import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { LAUNCH_PACKS } from "@/lib/launchReveal";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function orderId(): string {
  const t = Date.now().toString(36).toUpperCase();
  const r = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `KS-LR-${t}-${r}`;
}

/**
 * POST /api/orders — launch-reveal / marketing card orders (pending fulfilment).
 * No payment capture here; team confirms by phone.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const name = String(body.name || "").trim();
    const phone = String(body.phone || "")
      .replace(/\D/g, "")
      .slice(-10);
    const address = String(body.address || "").trim();
    const pack = String(body.pack || "").trim();
    const quantity = Math.min(
      3,
      Math.max(1, Number(body.quantity) || 1)
    );
    const packMeta = LAUNCH_PACKS.find((p) => p.id === pack);
    if (!name || name.length < 2) {
      return NextResponse.json({ error: "Name required" }, { status: 400 });
    }
    if (!/^[6-9]\d{9}$/.test(phone)) {
      return NextResponse.json(
        { error: "Valid 10-digit mobile required" },
        { status: 400 }
      );
    }
    if (address.length < 10) {
      return NextResponse.json(
        { error: "Full delivery address required" },
        { status: 400 }
      );
    }
    if (!packMeta) {
      return NextResponse.json({ error: "Invalid pack" }, { status: 400 });
    }
    const amount = packMeta.price * quantity;
    const id = orderId();
    const db = getAdminDb();
    await db.collection("orders").doc(id).set({
      order_id: id,
      source: "launch_reveal",
      name,
      phone,
      address,
      pack: packMeta.id,
      quantity,
      unit_price: packMeta.price,
      amount,
      status: "pending",
      created_at: FieldValue.serverTimestamp(),
      ua: req.headers.get("user-agent") || "",
    });
    return NextResponse.json({ ok: true, order_id: id, amount });
  } catch (err) {
    console.error("POST /api/orders", err);
    return NextResponse.json({ error: "Order failed" }, { status: 500 });
  }
}
