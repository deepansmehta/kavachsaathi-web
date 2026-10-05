import { NextRequest, NextResponse } from "next/server";
import { requireFeature } from "@/lib/features/server";
import {
  PROFILE_SESSION_COOKIE,
  verifyProfileSessionToken,
} from "@/lib/profileSession";
import { getAdminDb } from "@/lib/firebase-admin";
import { getBucket, isStorageConfigured } from "@/lib/storage";
import { noStoreHeaders } from "@/lib/forms/pdfCommon";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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

  const docRef = db
    .collection("profiles")
    .doc(sess.profileId)
    .collection("vault")
    .doc(params.id);

  const docSnap = await docRef.get();
  if (!docSnap.exists) {
    return NextResponse.json(
      { error: "Not found" },
      { status: 404, headers: noStoreHeaders() }
    );
  }

  const storagePath = docSnap.data()?.path as string | undefined;

  // Delete from storage if configured
  if (storagePath && isStorageConfigured()) {
    try {
      const bucket = getBucket();
      await bucket.file(storagePath).delete({ ignoreNotFound: true });
    } catch {
      // non-fatal
    }
  }

  await docRef.delete();

  return NextResponse.json({ success: true }, { headers: noStoreHeaders() });
}
