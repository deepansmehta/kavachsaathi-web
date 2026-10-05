import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireFeature } from "@/lib/features/server";
import {
  PROFILE_SESSION_COOKIE,
  verifyProfileSessionToken,
} from "@/lib/profileSession";
import { getAdminDb } from "@/lib/firebase-admin";
import { verifyUploadedObject } from "@/lib/storage";
import { noStoreHeaders } from "@/lib/forms/pdfCommon";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_VAULT_RECORDS = 30;

export async function POST(req: NextRequest) {
  const feature = await requireFeature("recordsVault");
  if (!feature) {
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
  const profSnap = await db.collection("profiles").doc(sess.profileId).get();
  if (!profSnap.exists) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: noStoreHeaders() }
    );
  }

  const body = await req.json();
  const path = String(body.path || "").trim();
  const contentType = String(body.contentType || "").trim();
  const type = String(body.type || "other").trim();
  const date = String(body.date || "").trim();
  const hospital = String(body.hospital || "").trim();

  if (!path || !contentType) {
    return NextResponse.json(
      { error: "Missing path or contentType" },
      { status: 400, headers: noStoreHeaders() }
    );
  }

  // Magic-byte verification
  const check = await verifyUploadedObject({ path, expectedType: contentType });
  if (!check.ok) {
    return NextResponse.json(
      { error: check.error },
      { status: 422, headers: noStoreHeaders() }
    );
  }

  // Count limit
  const countSnap = await db
    .collection("profiles")
    .doc(sess.profileId)
    .collection("vault")
    .count()
    .get();
  if (countSnap.data().count >= MAX_VAULT_RECORDS) {
    return NextResponse.json(
      { error: `Maximum ${MAX_VAULT_RECORDS} records allowed` },
      { status: 400, headers: noStoreHeaders() }
    );
  }

  const ref = await db
    .collection("profiles")
    .doc(sess.profileId)
    .collection("vault")
    .add({
      type,
      date: date || null,
      hospital: hospital || null,
      path,
      contentType,
      size: check.size,
      uploadedAt: FieldValue.serverTimestamp(),
    });

  // Access log
  await db.collection("accessLogs").add({
    profileId: sess.profileId,
    mode: "vault_confirm",
    path,
    at: FieldValue.serverTimestamp(),
  });

  return NextResponse.json(
    { id: ref.id, success: true },
    { headers: noStoreHeaders() }
  );
}
