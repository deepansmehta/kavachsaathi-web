import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireFeature } from "@/lib/features/server";
import {
  PROFILE_SESSION_COOKIE,
  verifyProfileSessionToken,
} from "@/lib/profileSession";
import {
  FULL_DETAILS_COOKIE,
  verifyFullDetailsToken,
} from "@/lib/fullDetailsSession";
import { getAdminDb } from "@/lib/firebase-admin";
import {
  getSignedGetUrl,
  getSignedPutUrl,
  isStorageConfigured,
  ALLOWED_UPLOAD_TYPES,
} from "@/lib/storage";
import { noStoreHeaders } from "@/lib/forms/pdfCommon";
import { encrypt, hasEncKey } from "@/lib/crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SIGNED_URL_TTL_MS = 5 * 60_000;

async function signed(path: string | null | undefined): Promise<string | null> {
  if (!path || !isStorageConfigured()) return null;
  try {
    return await getSignedGetUrl({ path, expiresMs: SIGNED_URL_TTL_MS });
  } catch {
    return null;
  }
}

/** GET /api/donor-directive — return donor directive data (PIN full-details session) */
export async function GET(req: NextRequest) {
  const feature = await requireFeature("donorDirective");
  if (!feature) {
    return NextResponse.json(
      { error: "Feature not available", code: "FEATURE_OFF" },
      { status: 404, headers: noStoreHeaders() }
    );
  }

  const fdToken = req.cookies.get(FULL_DETAILS_COOKIE)?.value;
  const fdSession = verifyFullDetailsToken(fdToken);
  if (!fdSession || fdSession.scope !== "pin") {
    return NextResponse.json(
      { error: "PIN session required" },
      { status: 401, headers: noStoreHeaders() }
    );
  }

  const db = getAdminDb();
  const q = await db
    .collection("profiles")
    .where("health_id", "==", fdSession.healthId)
    .limit(1)
    .get();
  if (q.empty) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: noStoreHeaders() });
  }
  const d = q.docs[0].data();

  const donor = d.donorDirective as
    | {
        bloodDonor?: boolean;
        organDonor?: string;
        nottoPledgeId?: string;
        advanceDirectivePath?: string;
      }
    | undefined;

  const advanceDirectiveUrl = await signed(donor?.advanceDirectivePath);

  return NextResponse.json(
    {
      bloodDonor: donor?.bloodDonor ?? null,
      organDonor: d.organDonor ?? "unset",
      nottoPledgeId: donor?.nottoPledgeId ?? null,
      advanceDirectiveUrl,
    },
    { headers: noStoreHeaders() }
  );
}

/** PATCH /api/donor-directive — update donor fields (profile session) */
export async function PATCH(req: NextRequest) {
  const feature = await requireFeature("donorDirective");
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
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: noStoreHeaders() });
  }

  const body = await req.json();
  const patch: Record<string, unknown> = {};

  if (typeof body.bloodDonor === "boolean") {
    patch["donorDirective.bloodDonor"] = body.bloodDonor;
  }
  if (typeof body.organDonor === "string") {
    patch.organDonor = body.organDonor;
  }
  if (typeof body.nottoPledgeId === "string") {
    const pledgeId = body.nottoPledgeId.trim();
    if (pledgeId && hasEncKey()) {
      patch["donorDirective.nottoPledgeId"] = encrypt(pledgeId);
    } else if (!pledgeId) {
      patch["donorDirective.nottoPledgeId"] = null;
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400, headers: noStoreHeaders() });
  }

  await db.collection("profiles").doc(sess.profileId).update(patch);
  return NextResponse.json({ success: true }, { headers: noStoreHeaders() });
}

/** POST /api/donor-directive/signed-put — get signed URL to upload advance directive */
export async function POST(req: NextRequest) {
  const feature = await requireFeature("donorDirective");
  if (!feature) {
    return NextResponse.json(
      { error: "Feature not available", code: "FEATURE_OFF" },
      { status: 404, headers: noStoreHeaders() }
    );
  }

  if (!isStorageConfigured()) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 503, headers: noStoreHeaders() });
  }

  const tok = req.cookies.get(PROFILE_SESSION_COOKIE)?.value;
  const sess = verifyProfileSessionToken(tok);
  if (!sess) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: noStoreHeaders() });
  }

  const db = getAdminDb();
  const profSnap = await db.collection("profiles").doc(sess.profileId).get();
  if (!profSnap.exists) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: noStoreHeaders() });
  }

  const health_id = String(profSnap.data()?.health_id || "");
  const body = await req.json();
  const contentType = String(body.contentType || "application/pdf");

  if (!ALLOWED_UPLOAD_TYPES.includes(contentType as (typeof ALLOWED_UPLOAD_TYPES)[number])) {
    return NextResponse.json({ error: "Invalid content type" }, { status: 400, headers: noStoreHeaders() });
  }

  const ext = contentType === "application/pdf" ? "pdf" : contentType === "image/png" ? "png" : "jpg";
  const path = `profiles/${health_id}/advance-directive.${ext}`;
  const url = await getSignedPutUrl({ path, contentType, expiresMs: 10 * 60_000 });

  return NextResponse.json(
    { url, path, contentType, expiresInSec: 600 },
    { headers: noStoreHeaders() }
  );
}

/** PUT /api/donor-directive — confirm advance directive upload (store path) */
export async function PUT(req: NextRequest) {
  const feature = await requireFeature("donorDirective");
  if (!feature) {
    return NextResponse.json(
      { error: "Feature not available", code: "FEATURE_OFF" },
      { status: 404, headers: noStoreHeaders() }
    );
  }

  const tok = req.cookies.get(PROFILE_SESSION_COOKIE)?.value;
  const sess = verifyProfileSessionToken(tok);
  if (!sess) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: noStoreHeaders() });
  }

  const body = await req.json();
  const path = String(body.path || "").trim();
  if (!path) {
    return NextResponse.json({ error: "Path required" }, { status: 400, headers: noStoreHeaders() });
  }

  const db = getAdminDb();
  await db
    .collection("profiles")
    .doc(sess.profileId)
    .update({
      "donorDirective.advanceDirectivePath": path,
      updatedAt: FieldValue.serverTimestamp(),
    });

  return NextResponse.json({ success: true }, { headers: noStoreHeaders() });
}
