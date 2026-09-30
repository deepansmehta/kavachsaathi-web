import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { findProfileByLogin } from "@/lib/activateCard";
import { hashPin, isValidPin, normalizePin } from "@/lib/pin";
import { normalizePhone, phoneLocal10, maskPhone } from "@/lib/phone";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";

/**
 * POST /api/profile/forgot-pin
 * Reset PIN by proving possession: activation_code + phone match.
 * Writes pin_hash on the same profiles doc that login reads.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const phoneNormalized = normalizePhone(String(body.phone || ""));
    const activation_code = String(body.activation_code || "")
      .trim()
      .padStart(4, "0")
      .slice(0, 4);
    const new_pin = normalizePin(body.new_pin || body.pin);

    if (!phoneNormalized || !/^\d{4}$/.test(activation_code)) {
      return NextResponse.json(
        { error: "Phone and 4-digit activation code are required" },
        { status: 400 }
      );
    }
    if (!isValidPin(new_pin)) {
      return NextResponse.json(
        { error: "New PIN must be 4–6 digits" },
        { status: 400 }
      );
    }

    const db = getAdminDb();
    const ip = clientIp(req);
    const rl = await checkRateLimit({
      key: `forgot-pin:${ip}`,
      limit: 8,
      windowMs: 15 * 60_000,
      captchaAfter: 4,
      db,
    });
    if (!rl.allowed) {
      return NextResponse.json(
        {
          error: "Too many attempts",
          code: "RATE_LIMITED",
          retryAfterSec: rl.retryAfterSec,
        },
        { status: 429 }
      );
    }

    const found = await findProfileByLogin(db, phoneNormalized);
    if (found.status === "ambiguous") {
      return NextResponse.json(
        {
          error:
            "Multiple profiles share this phone. Contact support with your Health ID.",
          code: "NEED_HEALTH_ID",
        },
        { status: 409 }
      );
    }
    if (found.status === "not_found") {
      console.error(
        `forgot-pin reason=not_found masked=${maskPhone(phoneNormalized)}`
      );
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const storedCode = String(found.data.activation_code || "")
      .padStart(4, "0")
      .slice(0, 4);
    const cardCode = found.card?.activation_code
      ? found.card.activation_code.padStart(4, "0").slice(0, 4)
      : "";

    if (activation_code !== storedCode && activation_code !== cardCode) {
      return NextResponse.json(
        { error: "Activation code or phone does not match" },
        { status: 403 }
      );
    }

    const pin_hash = await hashPin(new_pin);
    await db.collection("profiles").doc(found.profileId).update({
      pin_hash,
      phone: phoneLocal10(phoneNormalized),
      phoneNormalized,
      updated_at: FieldValue.serverTimestamp(),
      pin_reset_at: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      message: "PIN updated. You can log in on My Profile.",
    });
  } catch (err) {
    console.error("forgot-pin", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Reset failed" },
      { status: 500 }
    );
  }
}
