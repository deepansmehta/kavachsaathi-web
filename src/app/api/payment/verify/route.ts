import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { encrypt, hasEncKey } from "@/lib/crypto";
import { clientIp } from "@/lib/rateLimit";
import {
  razorpayConfigured,
  resolveOrderAmount,
  verifyRazorpaySignature,
} from "@/lib/razorpayServer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/payment/verify
 * Verifies Razorpay payment signature (HMAC SHA256). Only then writes a paid
 * order to Firestore via Admin SDK. Does NOT activate any card.
 */
export async function POST(req: NextRequest) {
  try {
    if (!razorpayConfigured()) {
      return NextResponse.json(
        { error: "Payment gateway not configured" },
        { status: 503 }
      );
    }
    if (!hasEncKey()) {
      return NextResponse.json(
        { error: "Orders unavailable" },
        { status: 503 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    const razorpay_order_id = String(body.razorpay_order_id || "").trim();
    const razorpay_payment_id = String(body.razorpay_payment_id || "").trim();
    const razorpay_signature = String(body.razorpay_signature || "").trim();
    const localOrderNo = String(body.localOrderNo || "").trim();

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json(
        { error: "Missing payment fields" },
        { status: 400 }
      );
    }

    const valid = verifyRazorpaySignature({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
    });
    if (!valid) {
      return NextResponse.json(
        { error: "Invalid payment signature", ok: false },
        { status: 400 }
      );
    }

    const name = String(body.name || "").trim();
    const phone = String(body.phone || "")
      .replace(/\D/g, "")
      .slice(-10);
    const email = String(body.email || "").trim();
    const address = String(body.address || "").trim();

    if (!name || !/^[6-9]\d{9}$/.test(phone) || address.length < 10) {
      return NextResponse.json(
        { error: "Customer details incomplete" },
        { status: 400 }
      );
    }

    const resolved = resolveOrderAmount({
      pack: String(body.pack || "Single"),
      quantity: Number(body.quantity) || 1,
      cards: body.cards != null ? Number(body.cards) : undefined,
    });

    const orderNo =
      localOrderNo && /^KS-ORD-[A-Z0-9]+$/i.test(localOrderNo)
        ? localOrderNo
        : `KS-ORD-${Date.now().toString(36).toUpperCase()}`;

    const db = getAdminDb();
    const ref = db.collection("orders").doc(orderNo);
    const existing = await ref.get();
    if (existing.exists && existing.data()?.status === "paid") {
      return NextResponse.json({
        ok: true,
        orderNo,
        amount: Number(existing.data()?.amount || resolved.amountInr),
        alreadyPaid: true,
        message: `Payment already recorded (${orderNo}). Activate your card after it arrives — pay first, then activate.`,
      });
    }

    // Idempotent on payment id
    const dup = await db
      .collection("orders")
      .where("razorpay_payment_id", "==", razorpay_payment_id)
      .limit(1)
      .get();
    if (!dup.empty) {
      const d = dup.docs[0];
      return NextResponse.json({
        ok: true,
        orderNo: d.id,
        amount: Number(d.data()?.amount || resolved.amountInr),
        alreadyPaid: true,
        message: `Payment already recorded (${d.id}).`,
      });
    }

    const addressEnc = encrypt(address);
    const ip = clientIp(req);

    await ref.set(
      {
        orderNo,
        pack: resolved.packId,
        cards: resolved.cardsLabel,
        cardCount: resolved.cardCount,
        qty: resolved.qty,
        amount: resolved.amountInr,
        unitPrice: resolved.unitPrice,
        name,
        phone,
        email: email || null,
        addressEnc,
        status: "paid",
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        source: String(body.source || "web_razorpay"),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        paidAt: FieldValue.serverTimestamp(),
        ip,
        ua: req.headers.get("user-agent") || "",
      },
      { merge: true }
    );

    return NextResponse.json({
      ok: true,
      orderNo,
      amount: resolved.amountInr,
      message: `Payment successful (${orderNo}). Your card(s) will be shipped. Activate after delivery — pay first, then activate.`,
    });
  } catch (err) {
    console.error("POST /api/payment/verify", err);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
