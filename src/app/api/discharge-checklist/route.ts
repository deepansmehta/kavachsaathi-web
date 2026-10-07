/**
 * F15 — Discharge Checklist API
 * GET  — read checklist state for a stay
 * POST — update/create checklist state
 *
 * Stays stored under profiles/{profileId}/stays/{stayId}
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
  CASHLESS_ITEMS,
  REIMBURSEMENT_ITEMS,
  checklistProgress,
  mergeChecklistState,
  type ChecklistState,
} from "@/lib/patientEase/dischargeChecklist";

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
  const flags = await requireFeature("dischargeChecklist");
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

  const { searchParams } = new URL(req.url);
  const stayId = searchParams.get("stayId") || "default";
  const mode = (searchParams.get("mode") as "cashless" | "reimbursement") || "cashless";

  const db = getAdminDb();
  const staySnap = await db
    .collection("profiles")
    .doc(profileId)
    .collection("stays")
    .doc(stayId)
    .get();

  const state: ChecklistState = staySnap.exists ? (staySnap.data()?.state ?? {}) : {};
  const items = mode === "reimbursement" ? REIMBURSEMENT_ITEMS : CASHLESS_ITEMS;
  const progress = checklistProgress(items, state);

  return NextResponse.json(
    { stayId, mode, state, items, progress },
    { status: 200, headers: noStoreHeaders() }
  );
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const flags = await requireFeature("dischargeChecklist");
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

  let body: {
    stayId?: string;
    mode?: "cashless" | "reimbursement";
    updates?: Record<string, boolean>;
    hospitalName?: string;
    admissionDate?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const stayId = String(body.stayId || "default").slice(0, 64);
  const mode = body.mode === "reimbursement" ? "reimbursement" : "cashless";
  const updates = body.updates;

  if (!updates || typeof updates !== "object") {
    return NextResponse.json({ error: "updates object required" }, { status: 400 });
  }

  // Validate updates — only boolean values
  const cleanUpdates: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(updates)) {
    if (typeof v === "boolean") cleanUpdates[k] = v;
  }

  const db = getAdminDb();
  const stayRef = db
    .collection("profiles")
    .doc(profileId)
    .collection("stays")
    .doc(stayId);

  const existing = await stayRef.get();
  const prevState: ChecklistState = existing.exists ? (existing.data()?.state ?? {}) : {};
  const newState = mergeChecklistState(prevState, cleanUpdates);

  await stayRef.set(
    {
      stayId,
      mode,
      state: newState,
      hospitalName: body.hospitalName ?? existing.data()?.hospitalName ?? "",
      admissionDate: body.admissionDate ?? existing.data()?.admissionDate ?? "",
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  const items = mode === "reimbursement" ? REIMBURSEMENT_ITEMS : CASHLESS_ITEMS;
  const progress = checklistProgress(items, newState);

  return NextResponse.json(
    { ok: true, stayId, mode, state: newState, progress },
    { status: 200, headers: noStoreHeaders() }
  );
}
