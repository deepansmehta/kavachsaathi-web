/**
 * F18 — Claim Deadline Tracker API
 * GET  — fetch saved deadline + countdown + docs list + calendar links
 * POST — save discharge date + window days
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
  computeClaimCountdown,
  claimDeadlineCalendarUrl,
  claimDeadlineIcs,
  REQUIRED_CLAIM_DOCS,
} from "@/lib/patientEase/claimDeadline";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function getProfileAndHealthId(
  req: NextRequest
): Promise<{ profileId: string; healthId: string } | null> {
  const tok = req.cookies.get(PROFILE_SESSION_COOKIE)?.value;
  const sess = verifyProfileSessionToken(tok);
  if (!sess) return null;
  const db = getAdminDb();
  const snap = await db.collection("profiles").doc(sess.profileId).get();
  if (!snap.exists) return null;
  const pd = snap.data()!;
  return {
    profileId: sess.profileId,
    healthId: pd.health_id || pd.healthId || "",
  };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const flags = await requireFeature("claimDeadline");
  if (!flags) {
    return NextResponse.json(
      { error: "Feature not available", code: "FEATURE_OFF" },
      { status: 404 }
    );
  }

  const identity = await getProfileAndHealthId(req);
  if (!identity) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401, headers: noStoreHeaders() });
  }

  const { profileId, healthId } = identity;
  const db = getAdminDb();
  const profileSnap = await db.collection("profiles").doc(profileId).get();
  const pd = profileSnap.data() || {};
  const saved = pd.claimDeadline as {
    dischargeDate?: string;
    windowDays?: number;
    patientName?: string;
  } | undefined;

  if (!saved?.dischargeDate) {
    return NextResponse.json(
      { claimDeadline: null, docs: REQUIRED_CLAIM_DOCS },
      { status: 200, headers: noStoreHeaders() }
    );
  }

  const data = {
    dischargeDate: saved.dischargeDate,
    windowDays: saved.windowDays ?? 30,
  };
  const countdown = computeClaimCountdown(data);
  const patientName = saved.patientName || pd.name || "Patient";

  const gcalUrl = claimDeadlineCalendarUrl({
    patientName,
    dischargeDate: data.dischargeDate,
    windowDays: data.windowDays,
  });

  const icsContent = claimDeadlineIcs({
    patientName,
    dischargeDate: data.dischargeDate,
    windowDays: data.windowDays,
    healthId,
  });

  return NextResponse.json(
    {
      claimDeadline: {
        ...data,
        patientName,
      },
      countdown,
      docs: REQUIRED_CLAIM_DOCS,
      gcalUrl,
      icsBase64: Buffer.from(icsContent).toString("base64"),
    },
    { status: 200, headers: noStoreHeaders() }
  );
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const flags = await requireFeature("claimDeadline");
  if (!flags) {
    return NextResponse.json(
      { error: "Feature not available", code: "FEATURE_OFF" },
      { status: 404 }
    );
  }

  const identity = await getProfileAndHealthId(req);
  if (!identity) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401, headers: noStoreHeaders() });
  }

  let body: { dischargeDate?: string; windowDays?: number; patientName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.dischargeDate) {
    return NextResponse.json({ error: "dischargeDate is required (ISO date)" }, { status: 400 });
  }

  // Validate date
  const d = new Date(body.dischargeDate);
  if (isNaN(d.getTime())) {
    return NextResponse.json({ error: "Invalid dischargeDate" }, { status: 400 });
  }

  const windowDays = Number(body.windowDays ?? 30);
  if (!Number.isFinite(windowDays) || windowDays < 1 || windowDays > 365) {
    return NextResponse.json(
      { error: "windowDays must be between 1 and 365" },
      { status: 400 }
    );
  }

  const { profileId, healthId } = identity;
  const db = getAdminDb();
  const profileSnap = await db.collection("profiles").doc(profileId).get();
  const pd = profileSnap.data() || {};
  const patientName = body.patientName || pd.name || "Patient";

  await db.collection("profiles").doc(profileId).set(
    {
      claimDeadline: {
        dischargeDate: body.dischargeDate,
        windowDays,
        patientName,
        savedAt: new Date().toISOString(),
      },
    },
    { merge: true }
  );

  const data = { dischargeDate: body.dischargeDate, windowDays };
  const countdown = computeClaimCountdown(data);
  const gcalUrl = claimDeadlineCalendarUrl({ patientName, ...data });
  const icsContent = claimDeadlineIcs({ patientName, healthId, ...data });

  return NextResponse.json(
    {
      ok: true,
      claimDeadline: { ...data, patientName },
      countdown,
      docs: REQUIRED_CLAIM_DOCS,
      gcalUrl,
      icsBase64: Buffer.from(icsContent).toString("base64"),
    },
    { status: 200, headers: noStoreHeaders() }
  );
}
