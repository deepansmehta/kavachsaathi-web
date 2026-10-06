import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { findCardByHealthId, cardIsActivated, cardIsBlocked } from "@/lib/cardsRepo";
import { isValidHealthId, normalizeHealthId } from "@/lib/healthId";
import {
  checkRateLimit,
  clientIp,
  makeMathCaptcha,
  verifyMathCaptcha,
} from "@/lib/rateLimit";
import {
  cityApproxFromHeaders,
  classifyUserAgent,
  logScanAtomic,
} from "@/lib/scans";
import { verifyScanToken } from "@/lib/scanToken";
import { recordAggEvent } from "@/lib/analytics";

/**
 * POST /api/scan
 * Privacy-safe scan log + optional emergency flag.
 * Body: { scanToken } preferred, or { health_id } (legacy/smoke).
 * Never accepts or stores GPS, IP, PIN, or activation_code.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const fromToken = body.scanToken
      ? verifyScanToken(String(body.scanToken))
      : null;
    const health_id = normalizeHealthId(
      fromToken || String(body.health_id || body.healthId || "")
    );
    if (!isValidHealthId(health_id)) {
      return NextResponse.json({ error: "Invalid health_id" }, { status: 400 });
    }

    const db = getAdminDb();
    const ip = clientIp(req);

    const rl = await checkRateLimit({
      key: `scan:${ip}`,
      limit: 30,
      windowMs: 60_000,
      captchaAfter: 15,
      db,
    });

    if (!rl.allowed) {
      return NextResponse.json(
        {
          error: "Too many scan requests. Please wait a moment.",
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

    const card = await findCardByHealthId(db, health_id);
    if (!card) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }
    if (cardIsBlocked(card)) {
      return NextResponse.json(
        { error: "Card is blocked", blocked: true },
        { status: 403 }
      );
    }
    if (!cardIsActivated(card)) {
      return NextResponse.json(
        { error: "Card not activated" },
        { status: 409 }
      );
    }

    const locationShared = Boolean(body.locationShared);
    const emergencyMode = Boolean(body.emergencyMode || body.emergency);
    const sectionsRendered = Array.isArray(body.sectionsRendered)
      ? body.sectionsRendered.map((s: unknown) => String(s)).slice(0, 12)
      : ["basic"];

    // cityApprox from CDN headers only — never from client lat/lng
    const cityApprox = cityApproxFromHeaders(req.headers);
    const userAgentType = classifyUserAgent(req.headers.get("user-agent"));

    const result = await logScanAtomic(db, card.docId, {
      healthId: health_id,
      cityApprox,
      locationShared,
      emergencyMode,
      userAgentType,
      sectionsRendered,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }

    // Aggregated analytics — date/batch/type + coarse geo only (no card id / IP)
    if (!result.deduped) {
      const geo = String(cityApprox || "");
      const parts = geo.split(",").map((s) => s.trim());
      void recordAggEvent(db, {
        type: "scan",
        batch: (card as { batch?: number | string }).batch ?? null,
        city: parts[0] || null,
        state: parts[1] || null,
      });
    }

    return NextResponse.json({
      success: true,
      scanId: result.scanId,
      deduped: result.deduped,
      scanCountInWindow: result.scanCountInWindow,
    });
  } catch (err) {
    console.error("api/scan", err);
    // Never break the public page — soft failure
    return NextResponse.json(
      { success: false, error: "Scan log skipped" },
      { status: 200 }
    );
  }
}
