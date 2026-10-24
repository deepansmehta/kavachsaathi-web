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
import { isValidHealthId, normalizeHealthId } from "@/lib/healthId";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_COVERED_MEMBERS = 8;

async function sessionProfile(req: NextRequest) {
  const tok = req.cookies.get(PROFILE_SESSION_COOKIE)?.value;
  const sess = verifyProfileSessionToken(tok);
  if (!sess) return null;
  const db = getAdminDb();
  const snap = await db.collection("profiles").doc(sess.profileId).get();
  if (!snap.exists) return null;
  return {
    db,
    profileId: sess.profileId,
    data: snap.data() as Record<string, unknown>,
  };
}

async function requireFamilyFloater() {
  const flags = await requireFeature("policyWallet");
  if (!flags || !flags.familyFloater) return null;
  return flags;
}

/** GET /api/policies/floater?policyId= — coverage status for a floater policy */
export async function GET(req: NextRequest) {
  const flags = await requireFamilyFloater();
  if (!flags) {
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

  const policyId = String(req.nextUrl.searchParams.get("policyId") || "").trim();
  if (!policyId) {
    return NextResponse.json(
      { error: "policyId required" },
      { status: 400, headers: noStoreHeaders() }
    );
  }

  const policies = readPoliciesFromProfile(ctx.data);
  const policy = policies.find((p) => p.id === policyId);
  if (!policy) {
    return NextResponse.json(
      { error: "Policy not found" },
      { status: 404, headers: noStoreHeaders() }
    );
  }

  return NextResponse.json(
    {
      isFamilyFloater: !!policy.isFamilyFloater,
      coveredMembers: policy.coveredMembers || [],
      maxMembers: MAX_COVERED_MEMBERS,
    },
    { headers: noStoreHeaders() }
  );
}

/** POST /api/policies/floater — link member(s). Body: { policyId, memberHealthIds: string[] } */
export async function POST(req: NextRequest) {
  const flags = await requireFamilyFloater();
  if (!flags) {
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

  const body = await req.json().catch(() => ({}));
  const policyId = String(body.policyId || "").trim();
  const rawIds: string[] = Array.isArray(body.memberHealthIds)
    ? body.memberHealthIds.map((x: unknown) => normalizeHealthId(String(x)))
    : [];
  if (!policyId || !rawIds.length) {
    return NextResponse.json(
      { error: "policyId and memberHealthIds required" },
      { status: 400, headers: noStoreHeaders() }
    );
  }
  for (const id of rawIds) {
    if (!isValidHealthId(id)) {
      return NextResponse.json(
        { error: `Invalid health_id: ${id}` },
        { status: 400, headers: noStoreHeaders() }
      );
    }
  }

  const policies = readPoliciesFromProfile(ctx.data);
  const idx = policies.findIndex((p) => p.id === policyId);
  if (idx < 0) {
    return NextResponse.json(
      { error: "Policy not found" },
      { status: 404, headers: noStoreHeaders() }
    );
  }
  const policy = policies[idx]!;
  const existingMembers = new Set(policy.coveredMembers || []);
  const nextMembers = new Set(existingMembers);
  for (const id of rawIds) nextMembers.add(id);
  if (nextMembers.size > MAX_COVERED_MEMBERS) {
    return NextResponse.json(
      { error: `Maximum ${MAX_COVERED_MEMBERS} covered members allowed` },
      { status: 400, headers: noStoreHeaders() }
    );
  }

  let linked = 0;
  for (const healthId of rawIds) {
    try {
      const q = await ctx.db
        .collection("profiles")
        .where("health_id", "==", healthId)
        .limit(1)
        .get();
      if (q.empty) continue;
      const memberDoc = q.docs[0]!;
      const memberData = memberDoc.data() as Record<string, unknown>;
      type FloaterEntry = {
        policyId?: string;
        showOnEmergencyScan?: boolean;
        insurerName?: string;
        type?: string;
        tpaName?: string | null;
        cashlessHelpline?: string | null;
        claimHelpline?: string | null;
        policyNumberLast4?: string | null;
        endDate?: string | null;
      };
      const floater = Array.isArray(memberData.floaterPolicies)
        ? (memberData.floaterPolicies as FloaterEntry[])
        : [];
      const filtered: FloaterEntry[] = floater.filter(
        (f) => f.policyId !== policyId
      );
      filtered.push({
        policyId,
        showOnEmergencyScan: policy.showOnEmergencyScan !== false,
        insurerName: policy.insurerName,
        type: policy.type,
        tpaName: policy.tpaName,
        cashlessHelpline: policy.cashlessHelpline,
        claimHelpline: policy.claimHelpline,
        policyNumberLast4: policy.policyNumberLast4,
        endDate: policy.endDate,
      });
      await memberDoc.ref.update({
        floaterPolicies: filtered,
        updatedAt: FieldValue.serverTimestamp(),
      });
      linked += 1;
    } catch {
      /* best-effort — skip members we can't find/update */
    }
  }

  policies[idx] = {
    ...policy,
    isFamilyFloater: true,
    coveredMembers: Array.from(nextMembers),
    updatedAt: new Date().toISOString(),
  };

  await ctx.db.collection("profiles").doc(ctx.profileId).update({
    policies,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json(
    { success: true, linked, coveredMembers: Array.from(nextMembers) },
    { headers: noStoreHeaders() }
  );
}

/** DELETE /api/policies/floater?policyId=&healthId= — unlink one member */
export async function DELETE(req: NextRequest) {
  const flags = await requireFamilyFloater();
  if (!flags) {
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

  const body = await req.json().catch(() => ({}));
  const policyId =
    req.nextUrl.searchParams.get("policyId") || String(body.policyId || "");
  const healthId = normalizeHealthId(
    req.nextUrl.searchParams.get("healthId") || String(body.healthId || "")
  );
  if (!policyId || !healthId) {
    return NextResponse.json(
      { error: "policyId and healthId required" },
      { status: 400, headers: noStoreHeaders() }
    );
  }

  const policies = readPoliciesFromProfile(ctx.data);
  const idx = policies.findIndex((p) => p.id === policyId);
  if (idx < 0) {
    return NextResponse.json(
      { error: "Policy not found" },
      { status: 404, headers: noStoreHeaders() }
    );
  }
  const policy = policies[idx]!;
  const nextMembers = (policy.coveredMembers || []).filter((m) => m !== healthId);
  policies[idx] = {
    ...policy,
    coveredMembers: nextMembers,
    updatedAt: new Date().toISOString(),
  };

  try {
    const q = await ctx.db
      .collection("profiles")
      .where("health_id", "==", healthId)
      .limit(1)
      .get();
    if (!q.empty) {
      const memberDoc = q.docs[0]!;
      const floater = Array.isArray(memberDoc.data().floaterPolicies)
        ? (memberDoc.data().floaterPolicies as Array<{ policyId?: string }>)
        : [];
      const filtered = floater.filter((f) => f.policyId !== policyId);
      await memberDoc.ref.update({ floaterPolicies: filtered });
    }
  } catch {
    /* best-effort */
  }

  await ctx.db.collection("profiles").doc(ctx.profileId).update({
    policies,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ success: true }, { headers: noStoreHeaders() });
}
