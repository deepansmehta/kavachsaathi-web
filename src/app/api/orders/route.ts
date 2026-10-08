import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { encrypt, hasEncKey } from "@/lib/crypto";
import {
  checkRateLimit,
  clientIp,
  makeMathCaptcha,
  verifyMathCaptcha,
} from "@/lib/rateLimit";
import { LAUNCH_PACKS } from "@/lib/launchReveal";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function orderNo(): string {
  const n = Math.floor(1000 + Math.random() * 9000);
  const t = Date.now().toString(36).toUpperCase().slice(-4);
  return `KS-ORD-${t}${n}`;
}

function cardsLabel(packId: string, cardCount: number): string {
  if (packId === "Parents Suraksha") return "2 cards + activation help";
  return `${cardCount} card${cardCount === 1 ? "" : "s"}`;
}

/**
 * POST /api/orders — marketing / launch pack orders.
 * Address stored encrypted. No payment gateway.
 * Rate limit 5/hour per IP; captcha after 3.
 */
export async function POST(req: NextRequest) {
  try {
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

    // Rehearsal / demo — never persist
    if (body.demo === true || body.rehearsal === true) {
      return NextResponse.json({
        ok: true,
        demo: true,
        orderNo: "KS-ORD-DEMO",
        message: "Demo — not saved",
      });
    }

    const db = getAdminDb();
    const ip = clientIp(req);
    const rl = await checkRateLimit({
      key: `orders:${ip}`,
      limit: 5,
      windowMs: 60 * 60 * 1000,
      captchaAfter: 3,
      db,
    });
    if (!rl.allowed) {
      return NextResponse.json(
        {
          error: "Too many orders. Try again later.",
          code: "RATE_LIMIT",
          retryAfterSec: rl.retryAfterSec,
        },
        { status: 429 }
      );
    }
    if (rl.captchaRequired) {
      const token = String(body.captchaToken || "");
      const answer = String(body.captchaAnswer || "");
      if (!token || !verifyMathCaptcha(token, answer)) {
        const captcha = makeMathCaptcha();
        return NextResponse.json(
          {
            error: "Captcha required",
            code: "CAPTCHA_REQUIRED",
            captcha,
          },
          { status: 429 }
        );
      }
    }

    const name = String(body.name || "").trim();
    const phone = String(body.phone || "")
      .replace(/\D/g, "")
      .slice(-10);
    const address = String(body.address || "").trim();
    const pack = String(body.pack || "").trim();
    const qty = Math.min(3, Math.max(1, Number(body.quantity) || 1));
    const packMeta = LAUNCH_PACKS.find((p) => p.id === pack);

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
    if (address.length < 10) {
      return NextResponse.json(
        {
          error:
            "Enter full delivery address with PIN. / पूरा पता और पिन कोड लिखें।",
        },
        { status: 400 }
      );
    }
    if (!packMeta) {
      return NextResponse.json({ error: "Invalid pack" }, { status: 400 });
    }

    const amount = packMeta.price * qty;
    const id = orderNo();
    const addressEnc = encrypt(address);
    await db.collection("orders").doc(id).set({
      orderNo: id,
      pack: packMeta.id,
      cards: cardsLabel(packMeta.id, packMeta.cardCount),
      cardCount: packMeta.cardCount,
      qty,
      amount,
      unitPrice: packMeta.price,
      name,
      phone,
      addressEnc,
      status: "requested",
      source: String(body.source || "web"),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      ip,
      ua: req.headers.get("user-agent") || "",
    });

    return NextResponse.json({
      ok: true,
      orderNo: id,
      amount,
      message: `Order received (${id}). Our team will call you to confirm payment and delivery.`,
    });
  } catch (err) {
    console.error("POST /api/orders", err);
    return NextResponse.json({ error: "Order failed" }, { status: 500 });
  }
}

/** GET /api/orders?captcha=1 — issue a math captcha when needed. */
export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("captcha") === "1") {
    return NextResponse.json({ captcha: makeMathCaptcha() });
  }
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
