/**
 * F19 — Attendant Pass Verification Endpoint
 * GET /pass/{rawToken} — verify token hash, check expiry/revoked, return scoped data.
 * Returns 410 Gone if expired or revoked.
 */

import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireFeature } from "@/lib/features/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { decrypt, hasEncKey } from "@/lib/crypto";
import { noStoreHeaders } from "@/lib/forms/pdfCommon";
import {
  hashToken,
  isPassValid,
  PASS_SCOPE_LABELS,
  type AttendantPassScope,
} from "@/lib/patientEase/attendantPass";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PASSES_COLLECTION = "attendant_passes";

function safeDec(enc: unknown): string {
  if (!enc || typeof enc !== "string" || !hasEncKey()) return "";
  try {
    return decrypt(enc);
  } catch {
    return "";
  }
}

/** Build watermark string for attendant pass response */
function passWatermark(passId: string, scope: string, expiresAt: string): string {
  return `KavachSaathi Attendant Pass | ID: ${passId} | Scope: ${scope} | Expires: ${expiresAt} | Single use — do not share`;
}

/** Filter profile data by scope */
function buildScopedData(
  profile: Record<string, unknown>,
  scope: AttendantPassScope,
  healthId: string
): Record<string, unknown> {
  const name = String(profile.name || "");
  const bloodGroup = String(profile.bloodGroup || profile.blood_group || "");
  const allergies = Array.isArray(profile.allergies) ? profile.allergies : [];
  const medications = Array.isArray(profile.medications) ? profile.medications : [];
  const conditions = Array.isArray(profile.conditions) ? profile.conditions : [];
  const emergencyContacts = Array.isArray(profile.emergencyContacts)
    ? profile.emergencyContacts
    : [];

  if (scope === "emergency_only") {
    return {
      healthId,
      name,
      bloodGroup,
      emergencyContacts,
    };
  }

  if (scope === "medical_summary") {
    return {
      healthId,
      name,
      bloodGroup,
      allergies,
      medications,
      conditions,
    };
  }

  // full_details — NO id images
  return {
    healthId,
    name,
    bloodGroup,
    allergies,
    medications,
    conditions,
    emergencyContacts,
    dob: profile.dob || "",
    gender: profile.gender || "",
    insurance: buildInsuranceSummary(profile.insurance),
    donorDirective: profile.donorDirective || null,
    coverageSnapshot: profile.coverageSnapshot || null,
  };
}

function buildInsuranceSummary(ins: unknown): Record<string, unknown> | null {
  if (!ins || typeof ins !== "object") return null;
  const i = ins as Record<string, unknown>;
  const priv = (i.private as Record<string, unknown>) || {};
  const gov = (i.government as Record<string, unknown>) || {};
  return {
    coverageType: i.coverageType || "",
    private: priv.insurerName
      ? {
          insurerName: priv.insurerName,
          policyNumber: safeDec(priv.policyNumberEnc),
          validTill: priv.validTill,
          tpaName: priv.tpaName,
        }
      : null,
    government: gov.schemeName
      ? {
          schemeName: gov.schemeName,
          govtCardNumber: safeDec(gov.govtCardNumberEnc),
        }
      : null,
  };
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ token: string }> }
): Promise<NextResponse> {
  const flags = await requireFeature("attendantPass");
  if (!flags) {
    return NextResponse.json(
      { error: "Feature not available", code: "FEATURE_OFF" },
      { status: 404 }
    );
  }

  const params = await context.params;
  const rawToken = params.token;
  if (!rawToken || rawToken.length < 60) {
    return NextResponse.json({ error: "Invalid pass token" }, { status: 400 });
  }

  const tokenHash = hashToken(rawToken);
  const db = getAdminDb();

  const passQuery = await db
    .collection(PASSES_COLLECTION)
    .where("tokenHash", "==", tokenHash)
    .limit(1)
    .get();

  if (passQuery.empty) {
    return NextResponse.json(
      { error: "Pass not found", code: "NOT_FOUND" },
      { status: 404 }
    );
  }

  const passDoc = passQuery.docs[0];
  const passData = passDoc.data();

  if (!isPassValid({ expiresAt: passData.expiresAt, revokedAt: passData.revokedAt })) {
    return NextResponse.json(
      {
        error: passData.revokedAt ? "Pass has been revoked" : "Pass has expired",
        code: passData.revokedAt ? "REVOKED" : "EXPIRED",
      },
      { status: 410 }
    );
  }

  // Log the use
  try {
    await passDoc.ref.update({
      usedAt: passData.usedAt || new Date().toISOString(),
      lastUsedAt: new Date().toISOString(),
      useCount: FieldValue.increment(1),
      lastUsedIp: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "",
    });
  } catch {
    // Non-fatal
  }

  // Load profile
  const profileSnap = await db.collection("profiles").doc(passData.profileId).get();
  if (!profileSnap.exists) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const pd = profileSnap.data()!;
  const healthId = String(pd.health_id || pd.healthId || "");
  const scope = passData.scope as AttendantPassScope;

  const scopedData = buildScopedData(pd, scope, healthId);
  const watermark = passWatermark(passDoc.id, scope, passData.expiresAt);

  return NextResponse.json(
    {
      passId: passDoc.id,
      scope,
      scopeLabel: PASS_SCOPE_LABELS[scope] ?? scope,
      expiresAt: passData.expiresAt,
      watermark,
      data: scopedData,
    },
    { status: 200, headers: noStoreHeaders() }
  );
}
