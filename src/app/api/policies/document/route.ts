import { NextRequest, NextResponse } from "next/server";
import { requireFeature } from "@/lib/features/server";
import {
  PROFILE_SESSION_COOKIE,
  verifyProfileSessionToken,
} from "@/lib/profileSession";
import { getAdminDb } from "@/lib/firebase-admin";
import { getSignedGetUrl, isStorageConfigured } from "@/lib/storage";
import { noStoreHeaders } from "@/lib/forms/pdfCommon";
import { readPoliciesFromProfile } from "@/lib/policy/cryptoPolicy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/policies/document?policyId=&path=
 * Returns a short-lived signed GET URL for a policy/claim document.
 * The path must already be attached to the caller's own policy or claim —
 * never issues signed URLs for arbitrary storage paths.
 */
export async function GET(req: NextRequest) {
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

  const policyId = String(req.nextUrl.searchParams.get("policyId") || "").trim();
  const path = String(req.nextUrl.searchParams.get("path") || "").trim();
  if (!policyId || !path) {
    return NextResponse.json(
      { error: "policyId and path required" },
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

  const db = getAdminDb();
  const snap = await db.collection("profiles").doc(sess.profileId).get();
  if (!snap.exists) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: noStoreHeaders() }
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

  const inPolicyDocs = policy.documents.some((d) => d.storagePath === path);
  const inClaimDocs = policy.claims.some((c) =>
    c.documents.some((d) => d.storagePath === path)
  );
  if (!inPolicyDocs && !inClaimDocs) {
    return NextResponse.json(
      { error: "Document not found" },
      { status: 404, headers: noStoreHeaders() }
    );
  }

  const url = await getSignedGetUrl({ path, expiresMs: 5 * 60_000 });

  return NextResponse.json(
    { url, expiresInSec: 300 },
    { headers: noStoreHeaders() }
  );
}
