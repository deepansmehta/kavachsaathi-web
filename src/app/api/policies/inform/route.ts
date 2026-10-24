import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { cardIsActivated, findCardByHealthId } from "@/lib/cardsRepo";
import { isValidHealthId, normalizeHealthId } from "@/lib/healthId";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import { requireFeature } from "@/lib/features/server";
import { readPoliciesFromProfile } from "@/lib/policy/cryptoPolicy";
import { buildInformInsurerMessage } from "@/lib/policy/informMessage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function loadProfileData(
  db: FirebaseFirestore.Firestore,
  health_id: string
): Promise<Record<string, unknown> | null> {
  const card = await findCardByHealthId(db, health_id);
  if (!card || !cardIsActivated(card)) return null;
  if (card.linkedProfileId) {
    const snap = await db.collection("profiles").doc(card.linkedProfileId).get();
    if (snap.exists) return snap.data() as Record<string, unknown>;
  }
  if (card.user_uid) {
    const snap = await db.collection("users").doc(card.user_uid).get();
    if (snap.exists) return snap.data() as Record<string, unknown>;
  }
  return null;
}

/**
 * GET /api/policies/inform?health_id=KVS-...&policyId=...&hospital=...&date=YYYY-MM-DD
 * Public — builds a pre-written "inform insurer" message. Only ever exposes a
 * masked policy number (never the full number). Rate-limited like /api/emergency.
 */
export async function GET(req: NextRequest) {
  const feature = await requireFeature("policyWallet");
  if (!feature) {
    return NextResponse.json(
      { error: "Feature not available", code: "FEATURE_OFF" },
      { status: 404 }
    );
  }

  const health_id = normalizeHealthId(
    req.nextUrl.searchParams.get("health_id") || ""
  );
  const policyId = String(req.nextUrl.searchParams.get("policyId") || "").trim();
  const hospital = String(req.nextUrl.searchParams.get("hospital") || "").trim();
  const date = String(req.nextUrl.searchParams.get("date") || "").trim();

  if (!isValidHealthId(health_id)) {
    return NextResponse.json({ error: "Invalid health_id format" }, { status: 400 });
  }

  let db: FirebaseFirestore.Firestore;
  try {
    db = getAdminDb();
  } catch {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const ip = clientIp(req);
  const rl = await checkRateLimit({
    key: `policy-inform:${ip}`,
    limit: 30,
    windowMs: 60_000,
    captchaAfter: 99,
    db,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests — slow down" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  const data = await loadProfileData(db, health_id);
  if (!data) {
    return NextResponse.json({ error: "Card not found or not activated" }, { status: 404 });
  }

  const policies = readPoliciesFromProfile(data).filter(
    (p) => p.showOnEmergencyScan !== false
  );
  const policy = policyId
    ? policies.find((p) => p.id === policyId)
    : policies[0];
  if (!policy) {
    return NextResponse.json({ error: "No eligible policy found" }, { status: 404 });
  }

  const holderName = String(data.full_name || data.name || "Cardholder").trim();
  const message = buildInformInsurerMessage({
    holderName,
    cardId: health_id,
    insurerName: policy.insurerName || "Insurer",
    policyNumberLast4: policy.policyNumberLast4,
    hospitalName: hospital,
    date,
  });

  return NextResponse.json({
    message,
    insurerName: policy.insurerName,
    type: policy.type,
  });
}
