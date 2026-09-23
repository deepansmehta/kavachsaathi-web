import { NextRequest, NextResponse } from "next/server";
import { CARD_PRICE } from "@/lib/pricing";

/**
 * Create Razorpay order.
 * Set RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET in env for live payments.
 * Falls back to demo order id when unset.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const amount = Number(body.amount) || CARD_PRICE;
    const product = "kavachsaathi_card";

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      return NextResponse.json({
        demo: true,
        orderId: `demo_order_${Date.now()}`,
        amount: amount * 100,
        currency: "INR",
        keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_demo",
        product,
      });
    }

    const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: amount * 100,
        currency: "INR",
        receipt: `kvs_${Date.now()}`,
        notes: { product },
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(
        { error: data.error?.description || "Razorpay error" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      orderId: data.id,
      amount: data.amount,
      currency: data.currency,
      keyId,
      product,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Order failed" },
      { status: 500 }
    );
  }
}
