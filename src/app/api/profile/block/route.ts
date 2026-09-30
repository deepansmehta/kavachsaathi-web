import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { cookies } from "next/headers";
import { getAdminDb } from "@/lib/firebase-admin";
import {
  PROFILE_SESSION_COOKIE,
  verifyProfileSessionToken,
} from "@/lib/profileSession";
import { findCardByHealthId, cardIsBlocked } from "@/lib/cardsRepo";
import { verifyPin } from "@/lib/pin";
import {
  checkRateLimit,
  clientIp,
  makeMathCaptcha,
  verifyMathCaptcha,
} from "@/lib/rateLimit";

/**
 * POST /api/profile/block
 * { action: "block"|"unblock", pin }
 * Block requires PIN re-entry. Uses runTransaction on card status.
 */
export async function POST(req: NextRequest) {
  try {
    const token = cookies().get(PROFILE_SESSION_COOKIE)?.value;
    const session = verifyProfileSessionToken(token);
    if (!session) {
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }

    const body = await req.json();
    const action = String(body.action || "").toLowerCase();
    const pin = String(body.pin || "");
    if (action !== "block" && action !== "unblock") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
    if (!/^\d{4,6}$/.test(pin)) {
      return NextResponse.json(
        { error: "Re-enter your PIN (4–6 digits)" },
        { status: 400 }
      );
    }

    const db = getAdminDb();
    const ip = clientIp(req);
    const rl = await checkRateLimit({
      key: `profile-block:${ip}`,
      limit: 10,
      windowMs: 5 * 60_000,
      captchaAfter: 5,
      db,
    });
    if (!rl.allowed) {
      return NextResponse.json(
        {
          error: "Too many attempts. Wait a few minutes.",
          captchaRequired: true,
          captcha: makeMathCaptcha(),
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

    const profileSnap = await db
      .collection("profiles")
      .doc(session.profileId)
      .get();
    if (!profileSnap.exists) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }
    const profile = profileSnap.data()!;
    const ok = await verifyPin(pin, String(profile.pin_hash || ""));
    if (!ok) {
      return NextResponse.json({ error: "Incorrect PIN" }, { status: 401 });
    }

    const health_id = String(profile.health_id || "");
    const card = await findCardByHealthId(db, health_id);
    if (!card) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    const cardRef = db.collection("cards").doc(card.docId);

    if (action === "block") {
      if (cardIsBlocked(card)) {
        return NextResponse.json({ success: true, status: "blocked" });
      }
      await db.runTransaction(async (tx) => {
        const fresh = await tx.get(cardRef);
        if (!fresh.exists) {
          throw Object.assign(new Error("Card not found"), { status: 404 });
        }
        const st = String(fresh.data()?.status || "");
        if (st === "blocked") return;
        if (st !== "activated" && st !== "active") {
          throw Object.assign(
            new Error("Only activated cards can be blocked"),
            { status: 409 }
          );
        }
        tx.update(cardRef, {
          status: "blocked",
          blocked_at: FieldValue.serverTimestamp(),
          // preserve health_id, activation_code, linkedProfileId, validTill
        });
      });
      return NextResponse.json({ success: true, status: "blocked" });
    }

    // unblock
    if (!cardIsBlocked(card)) {
      return NextResponse.json({ success: true, status: "activated" });
    }
    await db.runTransaction(async (tx) => {
      const fresh = await tx.get(cardRef);
      if (!fresh.exists) {
        throw Object.assign(new Error("Card not found"), { status: 404 });
      }
      if (String(fresh.data()?.status || "") !== "blocked") return;
      tx.update(cardRef, {
        status: "activated",
        unblocked_at: FieldValue.serverTimestamp(),
      });
    });
    return NextResponse.json({ success: true, status: "activated" });
  } catch (err) {
    const status =
      err && typeof err === "object" && "status" in err
        ? Number((err as { status: number }).status)
        : 500;
    const message = err instanceof Error ? err.message : "Block failed";
    console.error("profile/block", err);
    return NextResponse.json(
      { error: message },
      { status: status === 409 || status === 404 ? status : 500 }
    );
  }
}
