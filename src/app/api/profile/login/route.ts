import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { findProfileByLogin } from "@/lib/activateCard";
import { isValidPin, normalizePin, verifyPin } from "@/lib/pin";
import { maskPhone, normalizePhone } from "@/lib/phone";
import {
  makeProfileSessionToken,
  profileSessionCookieOptions,
} from "@/lib/profileSession";
import {
  checkRateLimit,
  clientIp,
  makeMathCaptcha,
  verifyMathCaptcha,
} from "@/lib/rateLimit";

function hasSessionSecret(): boolean {
  return Boolean(
    process.env.PROFILE_SESSION_SECRET &&
      process.env.PROFILE_SESSION_SECRET.length >= 16
  );
}

/** POST /api/profile/login — health_id or phone + PIN */
export async function POST(req: NextRequest) {
  try {
    if (
      process.env.NODE_ENV === "production" &&
      process.env.VERCEL_ENV !== "preview" &&
      !hasSessionSecret() &&
      process.env.NETLIFY === "true"
    ) {
      // Soft check: Netlify prod without PROFILE_SESSION_SECRET
    }
    if (
      process.env.NODE_ENV === "production" &&
      !hasSessionSecret() &&
      !process.env.FIREBASE_ADMIN_PRIVATE_KEY
    ) {
      console.error("profile/login reason=config masked=+91 XXXXXX****");
      return NextResponse.json(
        {
          error: "Server configuration error. Please try again later.",
          code: "SERVER_CONFIG",
        },
        { status: 503 }
      );
    }

    const body = await req.json();
    const identifier = String(
      body.identifier || body.health_id || body.phone || ""
    ).trim();
    const pin = normalizePin(body.pin);
    const db = getAdminDb();
    const ip = clientIp(req);

    const rateKey = (() => {
      const n = normalizePhone(identifier);
      if (n) return `profile-login:${ip}:${n}`;
      return `profile-login:${ip}:${identifier.slice(0, 40).toUpperCase()}`;
    })();

    // Peek first — do not burn quota on successful logins
    const peek = await checkRateLimit({
      key: rateKey,
      limit: 5,
      windowMs: 5 * 60_000,
      captchaAfter: 3,
      db,
      record: false,
    });

    if (!peek.allowed) {
      console.error(
        `profile/login reason=rate_limited masked=${maskPhone(identifier)}`
      );
      return NextResponse.json(
        {
          error: `Too many failed attempts. Try again in ${peek.retryAfterSec}s.`,
          code: "RATE_LIMITED",
          captchaRequired: true,
          captcha: makeMathCaptcha(),
          retryAfterSec: peek.retryAfterSec,
          attemptsLeft: 0,
        },
        { status: 429 }
      );
    }

    if (peek.captchaRequired) {
      if (
        !verifyMathCaptcha(
          String(body.captchaToken || ""),
          String(body.captchaAnswer || "")
        )
      ) {
        console.error(
          `profile/login reason=captcha masked=${maskPhone(identifier)}`
        );
        return NextResponse.json(
          {
            error: "CAPTCHA required",
            code: "CAPTCHA_REQUIRED",
            captchaRequired: true,
            captcha: makeMathCaptcha(),
            attemptsLeft: peek.remaining,
          },
          { status: 403 }
        );
      }
    }

    if (!identifier || !isValidPin(pin)) {
      const hit = await checkRateLimit({
        key: rateKey,
        limit: 5,
        windowMs: 5 * 60_000,
        captchaAfter: 3,
        db,
        record: true,
      });
      console.error(
        `profile/login reason=not_found masked=${maskPhone(identifier)}`
      );
      return NextResponse.json(
        {
          error: "Invalid phone number or PIN",
          code: "INVALID_CREDENTIALS",
          attemptsLeft: hit.remaining,
          ...(hit.captchaRequired
            ? { captchaRequired: true, captcha: makeMathCaptcha() }
            : {}),
        },
        { status: 401 }
      );
    }

    const found = await findProfileByLogin(db, identifier);

    if (found.status === "ambiguous") {
      console.error(
        `profile/login reason=ambiguous count=${found.count} masked=${maskPhone(identifier)}`
      );
      return NextResponse.json(
        {
          error:
            "Multiple profiles share this phone. Please log in with your Health ID instead.",
          code: "NEED_HEALTH_ID",
        },
        { status: 409 }
      );
    }

    if (found.status === "not_found") {
      const hit = await checkRateLimit({
        key: rateKey,
        limit: 5,
        windowMs: 5 * 60_000,
        captchaAfter: 3,
        db,
        record: true,
      });
      console.error(
        `profile/login reason=not_found masked=${maskPhone(identifier)}`
      );
      return NextResponse.json(
        {
          error: "Invalid phone number or PIN",
          code: "INVALID_CREDENTIALS",
          attemptsLeft: hit.remaining,
          ...(hit.captchaRequired
            ? { captchaRequired: true, captcha: makeMathCaptcha() }
            : {}),
        },
        { status: 401 }
      );
    }

    const ok = await verifyPin(pin, String(found.data.pin_hash || ""));
    if (!ok) {
      const hit = await checkRateLimit({
        key: rateKey,
        limit: 5,
        windowMs: 5 * 60_000,
        captchaAfter: 3,
        db,
        record: true,
      });
      console.error(
        `profile/login reason=pin_mismatch masked=${maskPhone(identifier)}`
      );
      return NextResponse.json(
        {
          error: "Invalid phone number or PIN",
          code: "INVALID_CREDENTIALS",
          attemptsLeft: hit.remaining,
          ...(hit.captchaRequired
            ? { captchaRequired: true, captcha: makeMathCaptcha() }
            : {}),
        },
        { status: 401 }
      );
    }

    const token = makeProfileSessionToken(found.profileId);
    const res = NextResponse.json({
      success: true,
      health_id: found.data.health_id,
      full_name: found.data.full_name,
    });
    const cookie = profileSessionCookieOptions(token);
    res.cookies.set(cookie.name, cookie.value, cookie);
    return res;
  } catch (err) {
    console.error("profile/login", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Login failed",
        code: "SERVER_ERROR",
      },
      { status: 500 }
    );
  }
}
