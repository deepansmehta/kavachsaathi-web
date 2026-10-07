/**
 * F19 — Attendant Pass API
 * POST   — create new pass (returns one-time raw token URL)
 * GET    — list active passes for profile
 * DELETE — revoke a pass by id
 *
 * Hashed token stored in attendant_passes collection.
 */

import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireFeature } from "@/lib/features/server";
import {
  PROFILE_SESSION_COOKIE,
  verifyProfileSessionToken,
} from "@/lib/profileSession";
import { getAdminDb } from "@/lib/firebase-admin";
import { noStoreHeaders } from "@/lib/forms/pdfCommon";
import {
  createAttendantPass,
  isValidScope,
  isValidPassHours,
  isPassValid,
  PASS_SCOPE_LABELS,
  type AttendantPassScope,
  type AttendantPassValidity,
} from "@/lib/patientEase/attendantPass";
import { SITE_URL } from "@/lib/config/links";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PASSES_COLLECTION = "attendant_passes";
const MAX_ACTIVE_PASSES = 10;

async function getProfileId(req: NextRequest): Promise<string | null> {
  const tok = req.cookies.get(PROFILE_SESSION_COOKIE)?.value;
  const sess = verifyProfileSessionToken(tok);
  if (!sess) return null;
  const db = getAdminDb();
  const snap = await db.collection("profiles").doc(sess.profileId).get();
  if (!snap.exists) return null;
  return sess.profileId;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const flags = await requireFeature("attendantPass");
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

  let body: { validityHours?: unknown; scope?: unknown; note?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!isValidPassHours(body.validityHours)) {
    return NextResponse.json(
      { error: "validityHours must be 6, 12, or 24" },
      { status: 400 }
    );
  }
  if (!isValidScope(body.scope)) {
    return NextResponse.json(
      { error: "scope must be: full_details | emergency_only | medical_summary" },
      { status: 400 }
    );
  }

  const db = getAdminDb();
  // Check active pass count
  const activePasses = await db
    .collection(PASSES_COLLECTION)
    .where("profileId", "==", profileId)
    .where("revokedAt", "==", null)
    .get();

  const stillActive = activePasses.docs.filter((d) =>
    isPassValid({ expiresAt: d.data().expiresAt, revokedAt: d.data().revokedAt })
  );

  if (stillActive.length >= MAX_ACTIVE_PASSES) {
    return NextResponse.json(
      { error: `Maximum ${MAX_ACTIVE_PASSES} active passes allowed` },
      { status: 429 }
    );
  }

  const pass = createAttendantPass({
    validityHours: body.validityHours as AttendantPassValidity,
    scope: body.scope as AttendantPassScope,
  });

  const docRef = db.collection(PASSES_COLLECTION).doc();
  await docRef.set({
    id: docRef.id,
    profileId,
    tokenHash: pass.tokenHash,
    scope: body.scope,
    validityHours: body.validityHours,
    expiresAt: pass.expiresAt,
    note: String(body.note || "").slice(0, 200),
    revokedAt: null,
    usedAt: null,
    createdAt: FieldValue.serverTimestamp(),
  });

  const passUrl = `${SITE_URL}/pass/${pass.rawToken}`;

  return NextResponse.json(
    {
      ok: true,
      passId: docRef.id,
      passUrl,
      expiresAt: pass.expiresAt,
      scope: body.scope,
      scopeLabel: PASS_SCOPE_LABELS[body.scope as AttendantPassScope],
      validityHours: body.validityHours,
      // rawToken returned only once — embedded in passUrl
    },
    { status: 201, headers: noStoreHeaders() }
  );
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const flags = await requireFeature("attendantPass");
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
  const passSnaps = await db
    .collection(PASSES_COLLECTION)
    .where("profileId", "==", profileId)
    .orderBy("createdAt", "desc")
    .limit(20)
    .get();

  const passes = passSnaps.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      scope: data.scope,
      scopeLabel: PASS_SCOPE_LABELS[data.scope as AttendantPassScope] ?? data.scope,
      validityHours: data.validityHours,
      expiresAt: data.expiresAt,
      note: data.note || "",
      revokedAt: data.revokedAt || null,
      usedAt: data.usedAt || null,
      isValid: isPassValid({ expiresAt: data.expiresAt, revokedAt: data.revokedAt }),
    };
  });

  return NextResponse.json(
    { passes },
    { status: 200, headers: noStoreHeaders() }
  );
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const flags = await requireFeature("attendantPass");
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

  let body: { passId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.passId) {
    return NextResponse.json({ error: "passId required" }, { status: 400 });
  }

  const db = getAdminDb();
  const passDoc = await db.collection(PASSES_COLLECTION).doc(body.passId).get();
  if (!passDoc.exists) {
    return NextResponse.json({ error: "Pass not found" }, { status: 404 });
  }
  if (passDoc.data()?.profileId !== profileId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await passDoc.ref.update({ revokedAt: new Date().toISOString() });

  return NextResponse.json(
    { ok: true, passId: body.passId, revokedAt: new Date().toISOString() },
    { status: 200, headers: noStoreHeaders() }
  );
}
