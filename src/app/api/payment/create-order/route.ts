import { NextRequest, NextResponse } from "next/server";
import { CARD_PRICE_PAISE } from "@/lib/pricing";
import {
  getRazorpayClient,
  getRazorpayKeyId,
  newLocalOrderNo,
  razorpayConfigured,
  resolveOrderAmount,
} from "@/lib/razorpayServer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/payment/create-order
 * Creates a Razorpay order (LIVE). Amount is computed server-side from pack/quantity.
 * Never accepts a client-supplied rupee/paise amount as the charge.
 */
export async function POST(req: NextRequest) {
  try {
    if (!razorpayConfigured()) {
      return NextResponse.json(
        {
          error:
            "Payment gateway not configured. Set RAZORPAY_KEY_SECRET and NEXT_PUBLIC_RAZORPAY_KEY_ID.",
        },
        { status: 503 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    const name = String(body.name || "").trim();
    const phone = String(body.phone || "")
      .replace(/\D/g, "")
      .slice(-10);
    const email = String(body.email || "").trim();
    const address = String(body.address || "").trim();

    if (!name || name.length < 2) {
      return NextResponse.json(
        { error: "Please enter your name. / कृपया नाम लिखें।" },
        { status: 400 }
      );
    }
    if (!/^[6-9]\d{9}$/.test(phone)) {
      return NextResponse.json(
        {
          error:
            "Enter a valid 10-digit mobile (starts 6–9). / सही 10 अंकों का मोबाइल लिखें।",
        },
        { status: 400 }
      );
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "Enter a valid email. / सही ईमेल लिखें।" },
        { status: 400 }
      );
    }
    if (address.length < 10) {
      return NextResponse.json(
        {
          error:
            "Enter full delivery address with PIN. / पूरा पता और पिन कोड लिखें।",
        },
        { status: 400 }
      );
    }

    const resolved = resolveOrderAmount({
      pack: String(body.pack || ""),
      quantity: Number(body.quantity) || 1,
      cards: body.cards != null ? Number(body.cards) : undefined,
    });

    if (resolved.amountPaise < CARD_PRICE_PAISE) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    const localOrderNo = newLocalOrderNo();
    const rzp = getRazorpayClient();
    const order = await rzp.orders.create({
      amount: resolved.amountPaise,
      currency: "INR",
      receipt: localOrderNo.slice(0, 40),
      notes: {
        product: "kavachsaathi_card",
        pack: resolved.packId,
        qty: String(resolved.qty),
        localOrderNo,
        phone,
      },
    });

    return NextResponse.json({
      ok: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency || "INR",
      keyId: getRazorpayKeyId(),
      localOrderNo,
      pack: resolved.packId,
      qty: resolved.qty,
      amountInr: resolved.amountInr,
      customer: {
        name,
        phone,
        email: email || undefined,
        address,
      },
    });
  } catch (err) {
    console.error("POST /api/payment/create-order", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message.slice(0, 120) : "Order failed",
      },
      { status: 500 }
    );
  }
}
