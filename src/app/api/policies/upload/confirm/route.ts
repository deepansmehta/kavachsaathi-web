import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireFeature } from "@/lib/features/server";
import {
  PROFILE_SESSION_COOKIE,
  verifyProfileSessionToken,
} from "@/lib/profileSession";
import { getAdminDb } from "@/lib/firebase-admin";
import { getBucket, isStorageConfigured, sniffContentType } from "@/lib/storage";
import { noStoreHeaders } from "@/lib/forms/pdfCommon";
import {
  DOC_KINDS,
  MAX_DOCS_PER_POLICY,
  MAX_POLICY_FILE_BYTES,
  type DocKind,
  type PolicyDocument,
} from "@/lib/policy/types";
import { readPoliciesFromProfile } from "@/lib/policy/cryptoPolicy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/policies/upload/confirm
 * Verifies the uploaded object (exists, ≤5MB, magic-byte matches), then
 * attaches it to the policy (or claim) document list. Rejects files >5MB.
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
  const path = String(body.path || "").trim();
  const contentType = String(body.contentType || "").trim();
  const kind = String(body.kind || "") as DocKind;
  const fileName = String(body.fileName || "document").trim().slice(0, 120);
  const claimId = body.claimId ? String(body.claimId) : null;

  if (!policyId || !path || !contentType) {
    return NextResponse.json(
      { error: "policyId, path and contentType required" },
      { status: 400, headers: noStoreHeaders() }
    );
  }
  if (!DOC_KINDS.includes(kind)) {
    return NextResponse.json(
      { error: "Invalid document kind" },
      { status: 400, headers: noStoreHeaders() }
    );
  }

  const expectedPrefix = `profiles/${sess.profileId}/policies/${policyId}/`;
  if (!path.startsWith(expectedPrefix)) {
    return NextResponse.json(
      { error: "Path not allowed" },
      { status: 403, headers: noStoreHeaders() }
    );
  }

  const policies = readPoliciesFromProfile(snap.data());
  const idx = policies.findIndex((p) => p.id === policyId);
  if (idx < 0) {
    return NextResponse.json(
      { error: "Policy not found" },
      { status: 404, headers: noStoreHeaders() }
    );
  }
  const policy = policies[idx]!;

  // Verify the uploaded object: exists, ≤5MB, magic bytes match declared type.
  const bucket = getBucket();
  const file = bucket.file(path);
  const [exists] = await file.exists();
  if (!exists) {
    return NextResponse.json(
      { error: "Upload missing" },
      { status: 422, headers: noStoreHeaders() }
    );
  }
  const [meta] = await file.getMetadata();
  const size = Number(meta.size || 0);
  if (size <= 0 || size > MAX_POLICY_FILE_BYTES) {
    await file.delete({ ignoreNotFound: true }).catch(() => {});
    return NextResponse.json(
      { error: "File too large — max 5MB" },
      { status: 422, headers: noStoreHeaders() }
    );
  }
  const [head] = await file.download({ start: 0, end: 15 });
  const sniffed = sniffContentType(head);
  if (!sniffed || sniffed !== contentType) {
    await file.delete({ ignoreNotFound: true }).catch(() => {});
    return NextResponse.json(
      { error: "File type not allowed — only PDF/JPG/PNG" },
      { status: 422, headers: noStoreHeaders() }
    );
  }

  const doc: PolicyDocument = {
    storagePath: path,
    fileName: fileName || "document",
    kind,
    contentType,
    uploadedAt: new Date().toISOString(),
  };

  if (claimId) {
    const cIdx = policy.claims.findIndex((c) => c.id === claimId);
    if (cIdx < 0) {
      await file.delete({ ignoreNotFound: true }).catch(() => {});
      return NextResponse.json(
        { error: "Claim not found" },
        { status: 404, headers: noStoreHeaders() }
      );
    }
    const claim = policy.claims[cIdx]!;
    if (claim.documents.length >= MAX_DOCS_PER_POLICY) {
      await file.delete({ ignoreNotFound: true }).catch(() => {});
      return NextResponse.json(
        { error: `Maximum ${MAX_DOCS_PER_POLICY} documents allowed per claim` },
        { status: 400, headers: noStoreHeaders() }
      );
    }
    const nextClaims = [...policy.claims];
    nextClaims[cIdx] = {
      ...claim,
      documents: [...claim.documents, doc],
      updatedAt: new Date().toISOString(),
    };
    policies[idx] = { ...policy, claims: nextClaims, updatedAt: new Date().toISOString() };
  } else {
    if (policy.documents.length >= MAX_DOCS_PER_POLICY) {
      await file.delete({ ignoreNotFound: true }).catch(() => {});
      return NextResponse.json(
        { error: `Maximum ${MAX_DOCS_PER_POLICY} documents allowed per policy` },
        { status: 400, headers: noStoreHeaders() }
      );
    }
    policies[idx] = {
      ...policy,
      documents: [...policy.documents, doc],
      updatedAt: new Date().toISOString(),
    };
  }

  await db.collection("profiles").doc(sess.profileId).update({
    policies,
    updatedAt: FieldValue.serverTimestamp(),
  });

  // Never log policy numbers or file names beyond this safe confirmation.
  return NextResponse.json(
    { success: true, document: doc },
    { headers: noStoreHeaders() }
  );
}
