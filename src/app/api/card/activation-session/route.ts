import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getAdminDb } from "@/lib/firebase-admin";
import { findCardByHealthId, cardIsActivated, cardIsBlocked } from "@/lib/cardsRepo";
import { normalizeHealthId, isValidHealthId } from "@/lib/healthId";
import {
  makeActivationSessionToken,
  activationSessionCookieOptions,
} from "@/lib/activationSession";
import { deletePrefix } from "@/lib/storage";
import {
  checkRateLimit,
  clientIp,
  makeMathCaptcha,
  verifyMathCaptcha,
} from "@/lib/rateLimit";

/**
 * POST /api/card/activation-session
 * Verify activation code → issue 15-min activation session (card NOT activated yet).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const health_id = normalizeHealthId(String(body.health_id || ""));
    const activation_code = String(body.activation_code || "")
      .trim()
      .padStart(4, "0")
      .slice(0, 4);
    const db = getAdminDb();
    const ip = clientIp(req);

    const rl = await checkRateLimit({
      key: `card-activate:${ip}`,
      limit: 15,
      windowMs: 15 * 60_000,
      captchaAfter: 6,
      db,
    });
    if (!rl.allowed) {
      return NextResponse.json(
        {
          error: "Too many attempts",
          captchaRequired: true,
          captcha: makeMathCaptcha(),
          retryAfterSec: rl.retryAfterSec,
        },
        { status: 429 }
      );
    }
    if (rl.captchaRequired) {
      if (
        !verifyMathCaptcha(
          String(body.captchaToken || ""),
          String(body.captchaAnswer || "")
        )
      ) {
        return NextResponse.json(
          {
            error: "CAPTCHA required",
            captchaRequired: true,
            captcha: makeMathCaptcha(),
          },
          { status: 403 }
        );
      }
    }

    if (!isValidHealthId(health_id) || !/^\d{4}$/.test(activation_code)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const card = await findCardByHealthId(db, health_id);
    if (!card) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }
    if (cardIsBlocked(card)) {
      return NextResponse.json({ error: "Card is blocked" }, { status: 403 });
    }
    if (cardIsActivated(card)) {
      return NextResponse.json({ error: "Already activated" }, { status: 409 });
    }
    if (card.activation_code.padStart(4, "0") !== activation_code) {
      return NextResponse.json(
        { error: "Activation code does not match this card" },
        { status: 403 }
      );
    }

    const sessionId = randomBytes(12).toString("hex");
    // Cleanup old pending uploads for this card
    await deletePrefix(`pending/${health_id}/`).catch(() => {});

    const token = makeActivationSessionToken(health_id, sessionId);
    const res = NextResponse.json({
      success: true,
      sessionId,
      health_id,
      expiresInSec: 15 * 60,
    });
    const cookie = activationSessionCookieOptions(token);
    res.cookies.set(cookie.name, cookie.value, cookie);
    return res;
  } catch (err) {
    console.error("activation-session", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
