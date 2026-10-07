/**
 * POST /api/disclosure-vault/signed-put
 * Returns a signed GCS URL to upload a disclosure document.
 * Auth: profile session only (not full-details session for uploads).
 */
import { NextRequest, NextResponse } from "next/server";
import { requireFeature } from "@/lib/features/server";
import {
  PROFILE_SESSION_COOKIE,
  verifyProfileSessionToken,
} from "@/lib/profileSession";
import { getAdminDb } from "@/lib/firebase-admin";
import {
  getSignedPutUrl,
  isStorageConfigured,
  ALLOWED_UPLOAD_TYPES,
} from "@/lib/storage";
import { noStoreHeaders } from "@/lib/forms/pdfCommon";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

export async function POST(req: NextRequest) {
  const flags = await requireFeature("disclosureVault");
  if (!flags) {
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

  const health_id = String(snap.data()?.health_id || sess.profileId);

  const body = await req.json();
  const contentType = String(body.contentType || "");

  if (
    !ALLOWED_UPLOAD_TYPES.includes(
      contentType as (typeof ALLOWED_UPLOAD_TYPES)[number]
    )
  ) {
    return NextResponse.json(
      { error: "Invalid content type" },
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
  const path = `disclosure_vault/${health_id}/${docId}.${ext}`;

  const url = await getSignedPutUrl({ path, contentType, expiresMs: 10 * 60_000 });

  return NextResponse.json(
    { url, path, docId, maxBytes: MAX_BYTES, contentType, expiresInSec: 600 },
    { headers: noStoreHeaders() }
  );
}
