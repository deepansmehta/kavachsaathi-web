import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import {
  cardIsActivated,
  findCardByHealthId,
  loadEmergencyProfile,
} from "@/lib/cardsRepo";
import { isValidHealthId, normalizeHealthId } from "@/lib/healthId";
import {
  checkRateLimit,
  clientIp,
  makeMathCaptcha,
  verifyMathCaptcha,
} from "@/lib/rateLimit";

/**
 * GET /api/emergency?health_id=KVS-...
 * Public emergency payload — rate-limited per IP. Never returns owner login phone.
 */
export async function GET(req: NextRequest) {
  try {
    const health_id = normalizeHealthId(
      req.nextUrl.searchParams.get("health_id") || ""
    );
    const captchaToken = req.nextUrl.searchParams.get("captchaToken") || "";
    const captchaAnswer = req.nextUrl.searchParams.get("captchaAnswer") || "";

    if (!isValidHealthId(health_id)) {
      return NextResponse.json(
        { error: "Invalid health_id format" },
        { status: 400 }
      );
    }

    let db;
    try {
      db = getAdminDb();
    } catch {
      return NextResponse.json(
        { error: "Server misconfigured" },
        { status: 500 }
      );
    }

    const ip = clientIp(req);
    const rl = await checkRateLimit({
      key: `emergency:${ip}`,
      limit: 40,
      windowMs: 60_000,
      captchaAfter: 15,
      db,
    });

    if (!rl.allowed) {
      const captcha = makeMathCaptcha();
      return NextResponse.json(
        {
          error: "Too many requests — slow down",
          captchaRequired: true,
          captcha,
          retryAfterSec: rl.retryAfterSec,
        },
        {
          status: 429,
          headers: { "Retry-After": String(rl.retryAfterSec) },
        }
      );
    }

    if (rl.captchaRequired) {
      if (!verifyMathCaptcha(captchaToken, captchaAnswer)) {
        const captcha = makeMathCaptcha();
        return NextResponse.json(
          {
            error: "CAPTCHA required after rapid requests",
            captchaRequired: true,
            captcha,
          },
          { status: 403 }
        );
      }
    }

    const card = await findCardByHealthId(db, health_id);
    if (!card) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    if (!cardIsActivated(card)) {
      return NextResponse.json({
        status: "unactivated",
        message: "This card has not been activated yet.",
      });
    }

    const profile = await loadEmergencyProfile(db, card);
    if (!profile) {
      return NextResponse.json({
        status: "activated",
        message: "Profile unavailable. Please contact KavachSaathi support.",
      });
    }

    // Explicit strip — never leak owner OTP/login phone
    const { ...safe } = profile;
    return NextResponse.json({
      status: "activated",
      profile: safe,
    });
  } catch (err) {
    console.error("GET /api/emergency", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}
