import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { findCardByHealthId, cardIsActivated, cardIsBlocked } from "@/lib/cardsRepo";
import { isValidHealthId, normalizeHealthId, normalizeCardStatus } from "@/lib/healthId";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";

/**
 * GET /api/cards?health_id=KVS-2026-XXXXX
 * Returns only status for activation gate — never dumps full card inventory.
 */
export async function GET(req: NextRequest) {
  try {
    const healthId = normalizeHealthId(
      req.nextUrl.searchParams.get("health_id") || ""
    );
    if (!isValidHealthId(healthId)) {
      return NextResponse.json(
        { error: "Invalid health_id format" },
        { status: 400 }
      );
    }

    const db = getAdminDb();
    const ip = clientIp(req);
    const rl = await checkRateLimit({
      key: `card-status:${ip}`,
      limit: 60,
      windowMs: 60_000,
      captchaAfter: 30,
      db,
    });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests", retryAfterSec: rl.retryAfterSec },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
      );
    }

    const card = await findCardByHealthId(db, healthId);
    if (!card) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    return NextResponse.json({
      health_id: card.health_id,
      status: cardIsBlocked(card)
        ? "blocked"
        : cardIsActivated(card)
          ? "activated"
          : "unactivated",
      tier: card.tier || "STANDARD",
      normalized: normalizeCardStatus(card.status),
    });
  } catch (err) {
    console.error("GET /api/cards", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}
