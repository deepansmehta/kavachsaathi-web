/**
 * /api/disclosure-vault — Insurance disclosure documents.
 * Collection: profiles/{profileId}/disclosure_vault
 * Max 10 files, 8 MB each.
 * Types: proposal_form | health_declaration | policy_schedule
 * Fields: policyNo, date (optional)
 * Auth: profile session OR full-details PIN session.
 * NEVER exposed to emergency/hospital access.
 */
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
import { getSignedGetUrl, isStorageConfigured } from "@/lib/storage";
import { noStoreHeaders } from "@/lib/forms/pdfCommon";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export type DisclosureDocType =
  | "proposal_form"
  | "health_declaration"
  | "policy_schedule";

const ALLOWED_TYPES: DisclosureDocType[] = [
  "proposal_form",
  "health_declaration",
  "policy_schedule",
];

const MAX_DOCS = 10;
const SIGNED_URL_TTL_MS = 5 * 60_000;
const COLLECTION = "disclosure_vault";

async function resolveProfileId(req: NextRequest): Promise<string | null> {
  const db = getAdminDb();

  // Profile session
  const tok = req.cookies.get(PROFILE_SESSION_COOKIE)?.value;
  const sess = verifyProfileSessionToken(tok);
  if (sess) {
    const snap = await db.collection("profiles").doc(sess.profileId).get();
    if (snap.exists) return sess.profileId;
  }

  // Full-details PIN session only (NOT emergency scope — never exposed to hospital)
  const fdToken = req.cookies.get(FULL_DETAILS_COOKIE)?.value;
  const fdSess = verifyFullDetailsToken(fdToken);
  if (fdSess?.scope === "pin") {
    const q = await db
      .collection("profiles")
      .where("health_id", "==", fdSess.healthId)
      .limit(1)
      .get();
    if (!q.empty) return q.docs[0].id;
  }

  return null;
}

async function signed(path: string | null | undefined): Promise<string | null> {
  if (!path || !isStorageConfigured()) return null;
  try {
    return await getSignedGetUrl({ path, expiresMs: SIGNED_URL_TTL_MS });
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const flags = await requireFeature("disclosureVault");
  if (!flags) {
    return NextResponse.json(
      { error: "Feature not available", code: "FEATURE_OFF" },
      { status: 404, headers: noStoreHeaders() }
    );
  }

  const profileId = await resolveProfileId(req);
  if (!profileId) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: noStoreHeaders() }
    );
  }

  const db = getAdminDb();
  const snap = await db
    .collection("profiles")
    .doc(profileId)
    .collection(COLLECTION)
    .orderBy("uploadedAt", "desc")
    .limit(MAX_DOCS)
    .get();

  const records = await Promise.all(
    snap.docs.map(async (doc) => {
      const d = doc.data();
      const url = await signed(d.path as string | undefined);
      return {
        id: doc.id,
        type: d.type as string,
        policyNo: (d.policyNo as string | null) ?? null,
        date: (d.date as string | null) ?? null,
        contentType: d.contentType as string,
        size: d.size as number,
        uploadedAt: (d.uploadedAt as { toDate?: () => Date })
          ?.toDate?.()
          ?.toISOString(),
        url,
      };
    })
  );

  return NextResponse.json(
    { records, total: snap.size },
    { headers: noStoreHeaders() }
  );
}

export async function POST(req: NextRequest) {
  const flags = await requireFeature("disclosureVault");
  if (!flags) {
    return NextResponse.json(
      { error: "Feature not available", code: "FEATURE_OFF" },
      { status: 404, headers: noStoreHeaders() }
    );
  }

  const profileId = await resolveProfileId(req);
  if (!profileId) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: noStoreHeaders() }
    );
  }

  const db = getAdminDb();
  const base = db.collection("profiles").doc(profileId);

  // Check limit
  const countSnap = await base.collection(COLLECTION).count().get();
  if (countSnap.data().count >= MAX_DOCS) {
    return NextResponse.json(
      { error: `Maximum ${MAX_DOCS} disclosure documents allowed` },
      { status: 400, headers: noStoreHeaders() }
    );
  }

  const body = await req.json();
  const type = String(body.type || "") as DisclosureDocType;
  if (!ALLOWED_TYPES.includes(type)) {
    return NextResponse.json(
      { error: `Invalid type. Allowed: ${ALLOWED_TYPES.join(", ")}` },
      { status: 400, headers: noStoreHeaders() }
    );
  }

  const path = String(body.path || "").trim();
  const contentType = String(body.contentType || "").trim();
  const size = Number(body.size || 0);

  if (!path || !contentType || size <= 0) {
    return NextResponse.json(
      { error: "path, contentType, and size are required" },
      { status: 400, headers: noStoreHeaders() }
    );
  }

  if (size > 8 * 1024 * 1024) {
    return NextResponse.json(
      { error: "File too large (max 8 MB)" },
      { status: 400, headers: noStoreHeaders() }
    );
  }

  const policyNo = String(body.policyNo || "").trim() || null;
  const date = String(body.date || "").trim() || null;

  await base.collection(COLLECTION).add({
    type,
    policyNo,
    date,
    path,
    contentType,
    size,
    uploadedAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ success: true }, { headers: noStoreHeaders() });
}

export async function DELETE(req: NextRequest) {
  const flags = await requireFeature("disclosureVault");
  if (!flags) {
    return NextResponse.json(
      { error: "Feature not available", code: "FEATURE_OFF" },
      { status: 404, headers: noStoreHeaders() }
    );
  }

  const profileId = await resolveProfileId(req);
  if (!profileId) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: noStoreHeaders() }
    );
  }

  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json(
      { error: "id is required" },
      { status: 400, headers: noStoreHeaders() }
    );
  }

  const db = getAdminDb();
  await db
    .collection("profiles")
    .doc(profileId)
    .collection(COLLECTION)
    .doc(id)
    .delete();

  return NextResponse.json({ success: true }, { headers: noStoreHeaders() });
}
