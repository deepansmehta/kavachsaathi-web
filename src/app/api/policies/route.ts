import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { requireFeature } from "@/lib/features/server";
import {
  PROFILE_SESSION_COOKIE,
  verifyProfileSessionToken,
} from "@/lib/profileSession";
import { getAdminDb } from "@/lib/firebase-admin";
import { hasEncKey } from "@/lib/crypto";
import { noStoreHeaders } from "@/lib/forms/pdfCommon";
import {
  MAX_POLICIES,
  POLICY_TYPES,
  type PolicyRecord,
  type PolicyType,
} from "@/lib/policy/types";
import {
  readPoliciesFromProfile,
  readReminderPrefs,
  toClientPolicy,
  toStoredPolicy,
} from "@/lib/policy/cryptoPolicy";
import { policyStatus } from "@/lib/policy/status";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function sessionProfile(req: NextRequest) {
  const tok = req.cookies.get(PROFILE_SESSION_COOKIE)?.value;
  const sess = verifyProfileSessionToken(tok);
  if (!sess) return null;
  const db = getAdminDb();
  const snap = await db.collection("profiles").doc(sess.profileId).get();
  if (!snap.exists) return null;
  return { db, profileId: sess.profileId, data: snap.data() as Record<string, unknown> };
}

/** GET — list policies for logged-in cardholder */
export async function GET(req: NextRequest) {
  const feature = await requireFeature("policyWallet");
  if (!feature) {
    return NextResponse.json(
      { error: "Feature not available", code: "FEATURE_OFF" },
      { status: 404, headers: noStoreHeaders() }
    );
  }
  if (!hasEncKey()) {
    return NextResponse.json(
      { error: "Encryption not configured" },
      { status: 503, headers: noStoreHeaders() }
    );
  }

  const ctx = await sessionProfile(req);
  if (!ctx) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: noStoreHeaders() }
    );
  }

  const stored = readPoliciesFromProfile(ctx.data);
  const policies = stored.map((p) => {
    const client = toClientPolicy(p);
    return {
      ...client,
      status: policyStatus(p.endDate),
    };
  });

  return NextResponse.json(
    {
      policies,
      reminderPrefs: readReminderPrefs(ctx.data),
      maxPolicies: MAX_POLICIES,
    },
    { headers: noStoreHeaders() }
  );
}

/** POST — create policy */
export async function POST(req: NextRequest) {
  const feature = await requireFeature("policyWallet");
  if (!feature) {
    return NextResponse.json(
      { error: "Feature not available", code: "FEATURE_OFF" },
      { status: 404, headers: noStoreHeaders() }
    );
  }
  if (!hasEncKey()) {
    return NextResponse.json(
      { error: "Encryption not configured" },
      { status: 503, headers: noStoreHeaders() }
    );
  }

  const ctx = await sessionProfile(req);
  if (!ctx) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: noStoreHeaders() }
    );
  }

  const existing = readPoliciesFromProfile(ctx.data);
  if (existing.length >= MAX_POLICIES) {
    return NextResponse.json(
      { error: `Maximum ${MAX_POLICIES} policies allowed` },
      { status: 400, headers: noStoreHeaders() }
    );
  }

  const body = await req.json();
  const type = String(body.type || "") as PolicyType;
  if (!POLICY_TYPES.includes(type)) {
    return NextResponse.json(
      { error: "Invalid policy type" },
      { status: 400, headers: noStoreHeaders() }
    );
  }
  const insurerName = String(body.insurerName || "").trim();
  if (!insurerName) {
    return NextResponse.json(
      { error: "Insurer name required" },
      { status: 400, headers: noStoreHeaders() }
    );
  }

  const id = `pol_${Date.now().toString(36)}_${randomBytes(3).toString("hex")}`;
  const input: Partial<PolicyRecord> & { id: string; type: PolicyType } = {
    id,
    type,
    insurerName,
    policyNumber: body.policyNumber ? String(body.policyNumber) : null,
    memberId: body.memberId ? String(body.memberId) : null,
    tpaName: body.tpaName ? String(body.tpaName) : null,
    cashlessHelpline: body.cashlessHelpline
      ? String(body.cashlessHelpline)
      : null,
    claimHelpline: body.claimHelpline ? String(body.claimHelpline) : null,
    sumInsured: body.sumInsured ? String(body.sumInsured) : null,
    roomRentLimit: body.roomRentLimit ? String(body.roomRentLimit) : null,
    coPayPercent: body.coPayPercent ? String(body.coPayPercent) : null,
    waitingPeriodNote: body.waitingPeriodNote
      ? String(body.waitingPeriodNote)
      : null,
    startDate: body.startDate ? String(body.startDate).slice(0, 10) : null,
    endDate: body.endDate ? String(body.endDate).slice(0, 10) : null,
    isFamilyFloater: !!body.isFamilyFloater,
    coveredMembers: Array.isArray(body.coveredMembers)
      ? body.coveredMembers.map(String)
      : [],
    nominee: body.nominee || null,
    agent: null,
    documents: [],
    claims: [],
    showOnEmergencyScan: body.showOnEmergencyScan !== false,
  };

  const stored = toStoredPolicy(input);
  const next = [...existing, stored];

  await ctx.db.collection("profiles").doc(ctx.profileId).update({
    policies: next,
    updatedAt: FieldValue.serverTimestamp(),
  });

  // Never log policy numbers
  return NextResponse.json(
    {
      policy: { ...toClientPolicy(stored), status: policyStatus(stored.endDate) },
    },
    { headers: noStoreHeaders() }
  );
}

/** PATCH — update policy (body.policyId required) */
export async function PATCH(req: NextRequest) {
  const feature = await requireFeature("policyWallet");
  if (!feature) {
    return NextResponse.json(
      { error: "Feature not available", code: "FEATURE_OFF" },
      { status: 404, headers: noStoreHeaders() }
    );
  }
  if (!hasEncKey()) {
    return NextResponse.json(
      { error: "Encryption not configured" },
      { status: 503, headers: noStoreHeaders() }
    );
  }

  const ctx = await sessionProfile(req);
  if (!ctx) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: noStoreHeaders() }
    );
  }

  const body = await req.json();
  const policyId = String(body.policyId || body.id || "").trim();
  if (!policyId) {
    return NextResponse.json(
      { error: "policyId required" },
      { status: 400, headers: noStoreHeaders() }
    );
  }

  const existing = readPoliciesFromProfile(ctx.data);
  const idx = existing.findIndex((p) => p.id === policyId);
  if (idx < 0) {
    return NextResponse.json(
      { error: "Policy not found" },
      { status: 404, headers: noStoreHeaders() }
    );
  }

  const cur = existing[idx]!;
  const type = (body.type ? String(body.type) : cur.type) as PolicyType;
  if (body.type && !POLICY_TYPES.includes(type)) {
    return NextResponse.json(
      { error: "Invalid policy type" },
      { status: 400, headers: noStoreHeaders() }
    );
  }

  const patch: Partial<PolicyRecord> & { id: string; type: PolicyType } = {
    id: policyId,
    type,
  };
  const fields: (keyof PolicyRecord)[] = [
    "insurerName",
    "policyNumber",
    "memberId",
    "tpaName",
    "cashlessHelpline",
    "claimHelpline",
    "sumInsured",
    "roomRentLimit",
    "coPayPercent",
    "waitingPeriodNote",
    "startDate",
    "endDate",
    "isFamilyFloater",
    "coveredMembers",
    "nominee",
    "showOnEmergencyScan",
    "documents",
    "claims",
    "agent",
  ];
  for (const f of fields) {
    if (body[f] !== undefined) {
      (patch as Record<string, unknown>)[f] = body[f];
    }
  }

  const stored = toStoredPolicy(patch, cur);
  const next = [...existing];
  next[idx] = stored;

  await ctx.db.collection("profiles").doc(ctx.profileId).update({
    policies: next,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json(
    {
      policy: { ...toClientPolicy(stored), status: policyStatus(stored.endDate) },
    },
    { headers: noStoreHeaders() }
  );
}

/** DELETE — remove policy (?policyId=) */
export async function DELETE(req: NextRequest) {
  const feature = await requireFeature("policyWallet");
  if (!feature) {
    return NextResponse.json(
      { error: "Feature not available", code: "FEATURE_OFF" },
      { status: 404, headers: noStoreHeaders() }
    );
  }

  const ctx = await sessionProfile(req);
  if (!ctx) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: noStoreHeaders() }
    );
  }

  const policyId =
    req.nextUrl.searchParams.get("policyId") ||
    String((await req.json().catch(() => ({}))).policyId || "");
  if (!policyId) {
    return NextResponse.json(
      { error: "policyId required" },
      { status: 400, headers: noStoreHeaders() }
    );
  }

  const existing = readPoliciesFromProfile(ctx.data);
  const next = existing.filter((p) => p.id !== policyId);
  if (next.length === existing.length) {
    return NextResponse.json(
      { error: "Policy not found" },
      { status: 404, headers: noStoreHeaders() }
    );
  }

  // Best-effort: remove floater links pointing at this policy
  const removed = existing.find((p) => p.id === policyId);
  if (removed?.coveredMembers?.length) {
    for (const memberHealthId of removed.coveredMembers) {
      try {
        const q = await ctx.db
          .collection("profiles")
          .where("health_id", "==", memberHealthId)
          .limit(1)
          .get();
        if (q.empty) continue;
        const doc = q.docs[0]!;
        const floater = Array.isArray(doc.data().floaterPolicies)
          ? (doc.data().floaterPolicies as Array<{ policyId?: string }>)
          : [];
        const filtered = floater.filter(
          (f) => f.policyId !== policyId
        );
        await doc.ref.update({ floaterPolicies: filtered });
      } catch {
        /* ignore */
      }
    }
  }

  await ctx.db.collection("profiles").doc(ctx.profileId).update({
    policies: next,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ success: true }, { headers: noStoreHeaders() });
}
