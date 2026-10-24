import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireFeature } from "@/lib/features/server";
import {
  PROFILE_SESSION_COOKIE,
  verifyProfileSessionToken,
} from "@/lib/profileSession";
import { getAdminDb } from "@/lib/firebase-admin";
import { noStoreHeaders } from "@/lib/forms/pdfCommon";
import { readPoliciesFromProfile } from "@/lib/policy/cryptoPolicy";
import { buildPolicyRenewalIcs } from "@/lib/policy/ics";
import { POLICY_TYPE_LABELS } from "@/lib/policy/constants";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/policies/ics?policyId= — downloads a .ics with 30/7/1-day renewal
 * reminders for the policy's endDate. Never includes the policy number.
 */
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
  const data = snap.data() as Record<string, unknown>;

  const policyId = String(req.nextUrl.searchParams.get("policyId") || "").trim();
  if (!policyId) {
    return NextResponse.json(
      { error: "policyId required" },
      { status: 400, headers: noStoreHeaders() }
    );
  }

  const policies = readPoliciesFromProfile(data);
  const policy = policies.find((p) => p.id === policyId);
  if (!policy) {
    return NextResponse.json(
      { error: "Policy not found" },
      { status: 404, headers: noStoreHeaders() }
    );
  }
  if (!policy.endDate) {
    return NextResponse.json(
      { error: "Policy has no end date set" },
      { status: 400, headers: noStoreHeaders() }
    );
  }

  const healthId = String(data.health_id || sess.profileId);
  const typeLabel = (POLICY_TYPE_LABELS[policy.type] || POLICY_TYPE_LABELS.other).en;

  let ics: string;
  try {
    ics = buildPolicyRenewalIcs({
      insurerName: policy.insurerName || "Insurer",
      policyTypeLabel: typeLabel,
      endDate: policy.endDate,
      healthId,
    });
  } catch {
    return NextResponse.json(
      { error: "Invalid end date" },
      { status: 400, headers: noStoreHeaders() }
    );
  }

  // Best-effort: mark calendar as exported for this profile.
  db.collection("profiles")
    .doc(sess.profileId)
    .set(
      {
        policyReminderPrefs: {
          ...(data.policyReminderPrefs as Record<string, unknown> | undefined),
          calendarExported: true,
        },
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    )
    .catch(() => {});

  return new NextResponse(ics, {
    status: 200,
    headers: {
      ...noStoreHeaders(),
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="policy-renewal-${policyId}.ics"`,
    },
  });
}
