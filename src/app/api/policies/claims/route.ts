import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { requireFeature } from "@/lib/features/server";
import {
  PROFILE_SESSION_COOKIE,
  verifyProfileSessionToken,
} from "@/lib/profileSession";
import { getAdminDb } from "@/lib/firebase-admin";
import { noStoreHeaders } from "@/lib/forms/pdfCommon";
import {
  CLAIM_STATUSES,
  CLAIM_TYPES,
  MAX_CLAIMS_PER_POLICY,
  type ClaimStatus,
  type ClaimType,
  type PolicyClaim,
} from "@/lib/policy/types";
import { readPoliciesFromProfile } from "@/lib/policy/cryptoPolicy";
import { checklistForClaimType } from "@/lib/policy/checklists";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

async function requireClaimHelper() {
  const flags = await requireFeature("policyWallet");
  if (!flags || !flags.claimHelper) return null;
  return flags;
}

function defaultChecklistTicks(type: ClaimType): Record<string, boolean> {
  const ticks: Record<string, boolean> = {};
  for (const item of checklistForClaimType(type)) ticks[item.id] = false;
  return ticks;
}

/** GET /api/policies/claims?policyId= — list claims (+ checklist) for a policy */
export async function GET(req: NextRequest) {
  const flags = await requireClaimHelper();
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

  const claims = policy.claims.map((c) => ({
    ...c,
    checklist: checklistForClaimType(c.claimType),
  }));

  return NextResponse.json(
    { claims, maxClaims: MAX_CLAIMS_PER_POLICY },
    { headers: noStoreHeaders() }
  );
}

/** POST /api/policies/claims — create claim. Body: { policyId, claimType, hospital?, admissionDate? } */
export async function POST(req: NextRequest) {
  const flags = await requireClaimHelper();
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
  const claimType = String(body.claimType || "") as ClaimType;
  if (!policyId) {
    return NextResponse.json(
      { error: "policyId required" },
      { status: 400, headers: noStoreHeaders() }
    );
  }
  if (!CLAIM_TYPES.includes(claimType)) {
    return NextResponse.json(
      { error: "Invalid claim type" },
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
  if (policy.claims.length >= MAX_CLAIMS_PER_POLICY) {
    return NextResponse.json(
      { error: `Maximum ${MAX_CLAIMS_PER_POLICY} claims allowed per policy` },
      { status: 400, headers: noStoreHeaders() }
    );
  }

  const now = new Date().toISOString();
  const claim: PolicyClaim = {
    id: `clm_${Date.now().toString(36)}_${randomBytes(3).toString("hex")}`,
    claimType,
    hospital: String(body.hospital || "").trim(),
    admissionDate: body.admissionDate ? String(body.admissionDate).slice(0, 10) : "",
    status: "intimated",
    notes: String(body.notes || "").trim(),
    checklistTicks: defaultChecklistTicks(claimType),
    documents: [],
    timeline: [{ status: "intimated", at: now }],
    createdAt: now,
    updatedAt: now,
  };

  const nextClaims = [...policy.claims, claim];
  policies[idx] = { ...policy, claims: nextClaims, updatedAt: now };

  await ctx.db.collection("profiles").doc(ctx.profileId).update({
    policies,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json(
    { claim: { ...claim, checklist: checklistForClaimType(claimType) } },
    { headers: noStoreHeaders() }
  );
}

/** PATCH /api/policies/claims — update claim. Body: { policyId, claimId, status?, notes?, checklistTicks? } */
export async function PATCH(req: NextRequest) {
  const flags = await requireClaimHelper();
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
  const claimId = String(body.claimId || "").trim();
  if (!policyId || !claimId) {
    return NextResponse.json(
      { error: "policyId and claimId required" },
      { status: 400, headers: noStoreHeaders() }
    );
  }

  const policies = readPoliciesFromProfile(ctx.data);
  const pIdx = policies.findIndex((p) => p.id === policyId);
  if (pIdx < 0) {
    return NextResponse.json(
      { error: "Policy not found" },
      { status: 404, headers: noStoreHeaders() }
    );
  }
  const policy = policies[pIdx]!;
  const cIdx = policy.claims.findIndex((c) => c.id === claimId);
  if (cIdx < 0) {
    return NextResponse.json(
      { error: "Claim not found" },
      { status: 404, headers: noStoreHeaders() }
    );
  }
  const claim = policy.claims[cIdx]!;
  const now = new Date().toISOString();
  const next: PolicyClaim = { ...claim };

  if (body.status !== undefined) {
    const status = String(body.status) as ClaimStatus;
    if (!CLAIM_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: "Invalid claim status" },
        { status: 400, headers: noStoreHeaders() }
      );
    }
    if (status !== claim.status) {
      next.status = status;
      next.timeline = [
        ...claim.timeline,
        { status, at: now, note: body.statusNote ? String(body.statusNote).trim() : undefined },
      ];
    }
  }
  if (body.hospital !== undefined) next.hospital = String(body.hospital || "").trim();
  if (body.admissionDate !== undefined) {
    next.admissionDate = body.admissionDate
      ? String(body.admissionDate).slice(0, 10)
      : "";
  }
  if (body.notes !== undefined) next.notes = String(body.notes || "").trim();
  if (body.checklistTicks && typeof body.checklistTicks === "object") {
    next.checklistTicks = {
      ...claim.checklistTicks,
      ...Object.fromEntries(
        Object.entries(body.checklistTicks as Record<string, unknown>).map(
          ([k, v]) => [k, Boolean(v)]
        )
      ),
    };
  }
  next.updatedAt = now;

  const nextClaims = [...policy.claims];
  nextClaims[cIdx] = next;
  policies[pIdx] = { ...policy, claims: nextClaims, updatedAt: now };

  await ctx.db.collection("profiles").doc(ctx.profileId).update({
    policies,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json(
    { claim: { ...next, checklist: checklistForClaimType(next.claimType) } },
    { headers: noStoreHeaders() }
  );
}

/** DELETE /api/policies/claims?policyId=&claimId= */
export async function DELETE(req: NextRequest) {
  const flags = await requireClaimHelper();
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
  const claimId =
    req.nextUrl.searchParams.get("claimId") || String(body.claimId || "");
  if (!policyId || !claimId) {
    return NextResponse.json(
      { error: "policyId and claimId required" },
      { status: 400, headers: noStoreHeaders() }
    );
  }

  const policies = readPoliciesFromProfile(ctx.data);
  const pIdx = policies.findIndex((p) => p.id === policyId);
  if (pIdx < 0) {
    return NextResponse.json(
      { error: "Policy not found" },
      { status: 404, headers: noStoreHeaders() }
    );
  }
  const policy = policies[pIdx]!;
  const nextClaims = policy.claims.filter((c) => c.id !== claimId);
  if (nextClaims.length === policy.claims.length) {
    return NextResponse.json(
      { error: "Claim not found" },
      { status: 404, headers: noStoreHeaders() }
    );
  }
  policies[pIdx] = { ...policy, claims: nextClaims, updatedAt: new Date().toISOString() };

  await ctx.db.collection("profiles").doc(ctx.profileId).update({
    policies,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ success: true }, { headers: noStoreHeaders() });
}
