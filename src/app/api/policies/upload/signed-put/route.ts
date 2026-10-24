import { NextRequest, NextResponse } from "next/server";
import { requireFeature } from "@/lib/features/server";
import {
  PROFILE_SESSION_COOKIE,
  verifyProfileSessionToken,
} from "@/lib/profileSession";
import { getAdminDb } from "@/lib/firebase-admin";
import {
  ALLOWED_UPLOAD_TYPES,
  getSignedPutUrl,
  isStorageConfigured,
} from "@/lib/storage";
import { noStoreHeaders } from "@/lib/forms/pdfCommon";
import {
  DOC_KINDS,
  MAX_DOCS_PER_POLICY,
  MAX_POLICY_FILE_BYTES,
  type DocKind,
} from "@/lib/policy/types";
import { readPoliciesFromProfile } from "@/lib/policy/cryptoPolicy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/policies/upload/signed-put
 * Issues a V4 signed PUT URL for a policy/claim document.
 * Body: { policyId, kind, contentType, claimId? }
 * Storage path: profiles/{profileId}/policies/{policyId}/{docId}.{ext}
 */
export async function POST(req: NextRequest) {
  const feature = await requireFeature("policyWallet");
  if (!feature) {
    return NextResponse.json(
      { error: "Feature not available", code: "FEATURE_OFF" },
      { status: 404, headers: noStoreHeaders() }
    );
  }

  if (!isStorageConfigured()) {
    return NextResponse.json(
      { error: "Storage not configured" },
      { status: 503, headers: noStoreHeaders() }
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
  const policyId = String(body.policyId || "").trim();
  const kind = String(body.kind || "") as DocKind;
  const contentType = String(body.contentType || "");
  const claimId = body.claimId ? String(body.claimId) : null;

  if (!policyId) {
    return NextResponse.json(
      { error: "policyId required" },
      { status: 400, headers: noStoreHeaders() }
    );
  }
  if (!DOC_KINDS.includes(kind)) {
    return NextResponse.json(
      { error: "Invalid document kind" },
      { status: 400, headers: noStoreHeaders() }
    );
  }
  if (
    !ALLOWED_UPLOAD_TYPES.includes(
      contentType as (typeof ALLOWED_UPLOAD_TYPES)[number]
    )
  ) {
    return NextResponse.json(
      { error: "Invalid content type — only PDF/JPG/PNG allowed" },
      { status: 400, headers: noStoreHeaders() }
    );
  }

  const policies = readPoliciesFromProfile(snap.data());
  const policy = policies.find((p) => p.id === policyId);
  if (!policy) {
    return NextResponse.json(
      { error: "Policy not found" },
      { status: 404, headers: noStoreHeaders() }
    );
  }

  if (claimId && kind === "claim_doc") {
    const claim = policy.claims.find((c) => c.id === claimId);
    if (!claim) {
      return NextResponse.json(
        { error: "Claim not found" },
        { status: 404, headers: noStoreHeaders() }
      );
    }
    if (claim.documents.length >= MAX_DOCS_PER_POLICY) {
      return NextResponse.json(
        { error: `Maximum ${MAX_DOCS_PER_POLICY} documents allowed per claim` },
        { status: 400, headers: noStoreHeaders() }
      );
    }
  } else if (policy.documents.length >= MAX_DOCS_PER_POLICY) {
    return NextResponse.json(
      { error: `Maximum ${MAX_DOCS_PER_POLICY} documents allowed per policy` },
      { status: 400, headers: noStoreHeaders() }
    );
  }

  const ext =
    contentType === "application/pdf"
      ? "pdf"
      : contentType === "image/png"
        ? "png"
        : "jpg";
  const docId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const path = `profiles/${sess.profileId}/policies/${policyId}/${docId}.${ext}`;

  const url = await getSignedPutUrl({
    path,
    contentType,
    expiresMs: 10 * 60_000,
  });

  return NextResponse.json(
    {
      url,
      path,
      docId,
      maxBytes: MAX_POLICY_FILE_BYTES,
      contentType,
      expiresInSec: 600,
    },
    { headers: noStoreHeaders() }
  );
}
