import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import {
  cardIsActivated,
  loadEmergencyProfile,
  type CardRecord,
} from "@/lib/cardsRepo";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";

/**
 * GET /api/doctor/patient?code=0001
 * Public doctor lookup by activation_code — returns emergency-safe fields only.
 */
export async function GET(req: NextRequest) {
  try {
    const code = String(req.nextUrl.searchParams.get("code") || "")
      .trim()
      .padStart(4, "0")
      .slice(0, 4);
    if (!/^\d{4}$/.test(code)) {
      return NextResponse.json({ error: "Invalid code" }, { status: 400 });
    }

    const db = getAdminDb();
    const ip = clientIp(req);
    const rl = await checkRateLimit({
      key: `doctor:${ip}`,
      limit: 30,
      windowMs: 60_000,
      captchaAfter: 12,
      db,
    });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests", retryAfterSec: rl.retryAfterSec },
        { status: 429 }
      );
    }

    const snap = await db.collection("cards").doc(code).get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }
    const data = snap.data()!;
    const card: CardRecord = {
      docId: snap.id,
      activation_code: String(data.activation_code || snap.id),
      health_id: String(data.health_id || ""),
      status: String(data.status || "unactivated"),
      user_uid: (data.user_uid as string) || null,
      linkedProfileId: (data.linkedProfileId as string) || null,
    };

    if (!cardIsActivated(card)) {
      return NextResponse.json({
        status: "unactivated",
        message: "This card has not been activated yet.",
      });
    }

    const profile = await loadEmergencyProfile(db, card);
    return NextResponse.json({
      status: "activated",
      health_id: card.health_id,
      activation_code: card.activation_code,
      profile,
    });
  } catch (err) {
    console.error("doctor/patient", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}
