/**
 * F14 — Coverage Snapshot API
 * GET  — read current snapshot (profile session required)
 * PATCH — update snapshot (profile session required)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireFeature } from "@/lib/features/server";
import {
  PROFILE_SESSION_COOKIE,
  verifyProfileSessionToken,
} from "@/lib/profileSession";
import { getAdminDb } from "@/lib/firebase-admin";
import { noStoreHeaders } from "@/lib/forms/pdfCommon";
import {
  emptyCoverageSnapshot,
  validateCoverageSnapshot,
  type CoverageSnapshot,
} from "@/lib/patientEase/coverage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function getProfileId(req: NextRequest): Promise<string | null> {
  const tok = req.cookies.get(PROFILE_SESSION_COOKIE)?.value;
  const sess = verifyProfileSessionToken(tok);
  if (!sess) return null;
  const db = getAdminDb();
  const snap = await db.collection("profiles").doc(sess.profileId).get();
  if (!snap.exists) return null;
  return sess.profileId;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const flags = await requireFeature("coverageSnapshot");
  if (!flags) {
    return NextResponse.json(
      { error: "Feature not available", code: "FEATURE_OFF" },
      { status: 404 }
    );
  }

  const profileId = await getProfileId(req);
  if (!profileId) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401, headers: noStoreHeaders() });
  }

  const db = getAdminDb();
  const snap = await db.collection("profiles").doc(profileId).get();
  const data = snap.data();
  const coverageSnapshot: CoverageSnapshot =
    data?.coverageSnapshot ?? emptyCoverageSnapshot();

  return NextResponse.json(
    { coverageSnapshot },
    { status: 200, headers: noStoreHeaders() }
  );
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const flags = await requireFeature("coverageSnapshot");
  if (!flags) {
    return NextResponse.json(
      { error: "Feature not available", code: "FEATURE_OFF" },
      { status: 404 }
    );
  }

  const profileId = await getProfileId(req);
  if (!profileId) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401, headers: noStoreHeaders() });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const validationError = validateCoverageSnapshot(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const now = new Date().toISOString();
  const b = body as Record<string, unknown>;
  const snapshot: CoverageSnapshot = {
    sumInsured: Number(b.sumInsured ?? 0),
    usedSoFar: Number(b.usedSoFar ?? 0),
    roomRentLimit: (b.roomRentLimit as CoverageSnapshot["roomRentLimit"]) ?? {
      type: "none",
      value: 0,
    },
    icuLimit: Number(b.icuLimit ?? 0),
    copayPercent: Number(b.copayPercent ?? 0),
    deductible: Number(b.deductible ?? 0),
    policyStartDate: String(b.policyStartDate ?? ""),
    waitingPeriods: (b.waitingPeriods as CoverageSnapshot["waitingPeriods"]) ?? {
      initial: 0,
      specific: 0,
      preExisting: 0,
    },
    subLimitsText: String(b.subLimitsText ?? ""),
    restoration: Boolean(b.restoration ?? false),
    updatedAt: now,
  };

  const db = getAdminDb();
  await db.collection("profiles").doc(profileId).set(
    { coverageSnapshot: snapshot },
    { merge: true }
  );

  return NextResponse.json(
    { ok: true, coverageSnapshot: snapshot },
    { status: 200, headers: noStoreHeaders() }
  );
}
