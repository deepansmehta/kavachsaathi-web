import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireFeature } from "@/lib/features/server";
import {
  PROFILE_SESSION_COOKIE,
  verifyProfileSessionToken,
} from "@/lib/profileSession";
import { getAdminDb } from "@/lib/firebase-admin";
import { noStoreHeaders } from "@/lib/forms/pdfCommon";
import { readReminderPrefs } from "@/lib/policy/cryptoPolicy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/policies/reminders — current reminder preferences */
export async function GET(req: NextRequest) {
  const flags = await requireFeature("policyWallet");
  if (!flags || !flags.policyReminders) {
    return NextResponse.json(
      { error: "Feature not available", code: "FEATURE_OFF" },
      { status: 404, headers: noStoreHeaders() }
    );
  }

  const tok = req.cookies.get(PROFILE_SESSION_COOKIE)?.value;
  const sess = verifyProfileSessionToken(tok);
  if (!sess) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: noStoreHeaders() }
    );
  }

  const db = getAdminDb();
  const snap = await db.collection("profiles").doc(sess.profileId).get();
  if (!snap.exists) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: noStoreHeaders() }
    );
  }

  return NextResponse.json(
    { reminderPrefs: readReminderPrefs(snap.data()), pushAvailable: !!flags.policyPush },
    { headers: noStoreHeaders() }
  );
}

/**
 * POST /api/policies/reminders — update reminder preferences.
 * Body: { push?: boolean, fcmToken?: string | null, calendarExported?: boolean }
 * Setting push/fcmToken requires the policyPush flag as well.
 */
export async function POST(req: NextRequest) {
  const flags = await requireFeature("policyWallet");
  if (!flags || !flags.policyReminders) {
    return NextResponse.json(
      { error: "Feature not available", code: "FEATURE_OFF" },
      { status: 404, headers: noStoreHeaders() }
    );
  }

  const tok = req.cookies.get(PROFILE_SESSION_COOKIE)?.value;
  const sess = verifyProfileSessionToken(tok);
  if (!sess) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: noStoreHeaders() }
    );
  }

  const db = getAdminDb();
  const snap = await db.collection("profiles").doc(sess.profileId).get();
  if (!snap.exists) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: noStoreHeaders() }
    );
  }

  const body = await req.json().catch(() => ({}));
  const current = readReminderPrefs(snap.data());
  const next: Record<string, unknown> = { ...current };

  if (body.push !== undefined) {
    if (!flags.policyPush) {
      return NextResponse.json(
        { error: "Push reminders not available", code: "FEATURE_OFF" },
        { status: 404, headers: noStoreHeaders() }
      );
    }
    next.push = Boolean(body.push);
  }
  if (body.fcmToken !== undefined) {
    if (!flags.policyPush) {
      return NextResponse.json(
        { error: "Push reminders not available", code: "FEATURE_OFF" },
        { status: 404, headers: noStoreHeaders() }
      );
    }
    next.fcmToken = body.fcmToken ? String(body.fcmToken).slice(0, 4096) : null;
  }
  if (body.calendarExported !== undefined) {
    next.calendarExported = Boolean(body.calendarExported);
  }

  await db.collection("profiles").doc(sess.profileId).set(
    {
      policyReminderPrefs: next,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return NextResponse.json(
    { reminderPrefs: next },
    { headers: noStoreHeaders() }
  );
}
