import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import {
  PROFILE_SESSION_COOKIE,
  verifyProfileSessionToken,
} from "@/lib/profileSession";
import { hashPin, isValidPin, normalizePin, verifyPin } from "@/lib/pin";
import {
  checkRateLimit,
  clientIp,
  makeMathCaptcha,
  verifyMathCaptcha,
} from "@/lib/rateLimit";

/** POST /api/profile/change-pin — current PIN + new PIN (session required) */
export async function POST(req: NextRequest) {
  try {
    const token = cookies().get(PROFILE_SESSION_COOKIE)?.value;
    const session = verifyProfileSessionToken(token);
    if (!session) {
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }

    const body = await req.json();
    const currentPin = normalizePin(body.currentPin || body.pin);
    const newPin = normalizePin(body.newPin || body.new_pin);
    const db = getAdminDb();
    const ip = clientIp(req);

    const rl = await checkRateLimit({
      key: `change-pin:${ip}:${session.profileId}`,
      limit: 8,
      windowMs: 15 * 60_000,
      captchaAfter: 3,
      db,
    });
    if (!rl.allowed) {
      return NextResponse.json(
        {
          error: "Too many attempts. Try again later.",
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

    if (!isValidPin(currentPin) || !isValidPin(newPin)) {
      return NextResponse.json(
        {
          error:
            "PIN must be 4–6 digits / पिन 4–6 अंकों का होना चाहिए",
        },
        { status: 400 }
      );
    }
    if (currentPin === newPin) {
      return NextResponse.json(
        {
          error:
            "New PIN must be different / नया पिन अलग होना चाहिए",
        },
        { status: 400 }
      );
    }

    const ref = db.collection("profiles").doc(session.profileId);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }
    const hash = String(snap.data()?.pin_hash || "");
    const ok = await verifyPin(currentPin, hash);
    if (!ok) {
      return NextResponse.json(
        {
          error:
            "Current PIN incorrect / वर्तमान पिन गलत है",
          attemptsLeft: rl.remaining,
        },
        { status: 401 }
      );
    }

    await ref.update({
      pin_hash: await hashPin(newPin),
      updated_at: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("profile/change-pin", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
