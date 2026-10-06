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
import { computeValidity, pastGraceResponseBody } from "@/lib/validity";
import { loadFeatureFlags } from "@/lib/features/server";
import { findCardByHealthId } from "@/lib/cardsRepo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_VAULT_RECORDS = 30;
const VAULT_COLLECTION = "vault";
const SIGNED_URL_TTL_MS = 5 * 60_000; // 5 minutes

async function assertOwnerNotPastGrace(profileId: string) {
  const flags = await loadFeatureFlags().catch(() => null);
  if (!flags?.cardValidity) return null;
  const db = getAdminDb();
  const p = await db.collection("profiles").doc(profileId).get();
  if (!p.exists) return null;
  const hid = String(p.data()?.health_id || "");
  const card = await findCardByHealthId(db, hid);
  if (!card) return null;
  const v = computeValidity({
    validFrom: card.validFrom || card.activated_at,
    validTill: card.validTill,
    activatedAt: card.activated_at,
  });
  if (v.ownerFeaturesLocked) {
    return NextResponse.json(pastGraceResponseBody(), {
      status: 403,
      headers: noStoreHeaders(),
    });
  }
  return null;
}

export type VaultRecordType =
  | "discharge_summary"
  | "lab_report"
  | "prescription"
  | "other";

async function getProfileId(req: NextRequest): Promise<string | null> {
  const tok = req.cookies.get(PROFILE_SESSION_COOKIE)?.value;
  const sess = verifyProfileSessionToken(tok);
  if (!sess) return null;
  const db = getAdminDb();
  const snap = await db.collection("profiles").doc(sess.profileId).get();
  if (!snap.exists) return null;
  return sess.profileId;
}

async function signed(path: string | null | undefined): Promise<string | null> {
  if (!path || !isStorageConfigured()) return null;
  try {
    return await getSignedGetUrl({ path, expiresMs: SIGNED_URL_TTL_MS });
  } catch {
    return null;
  }
}

/** GET /api/vault — list vault records (profile session or PIN full-details) */
export async function GET(req: NextRequest) {
  const feature = await requireFeature("recordsVault");
  if (!feature) {
    return NextResponse.json(
      { error: "Feature not available", code: "FEATURE_OFF" },
      { status: 404, headers: noStoreHeaders() }
    );
  }

  const db = getAdminDb();
  let profileId: string | null = null;
  let isFullDetails = false;

  // Check for full-details PIN session (for FullDetailsModal → latest 3)
  const fdToken = req.cookies.get(FULL_DETAILS_COOKIE)?.value;
  const fdSession = verifyFullDetailsToken(fdToken);
  if (fdSession && fdSession.scope === "pin") {
    isFullDetails = true;
    // Resolve profileId from healthId
    const q = await db
      .collection("profiles")
      .where("health_id", "==", fdSession.healthId)
      .limit(1)
      .get();
    if (!q.empty) profileId = q.docs[0].id;
  }

  if (!profileId) {
    profileId = await getProfileId(req);
  }

  if (!profileId) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: noStoreHeaders() }
    );
  }

  const locked = await assertOwnerNotPastGrace(profileId);
  if (locked) return locked;

  const snap = await db
    .collection("profiles")
    .doc(profileId)
    .collection(VAULT_COLLECTION)
    .orderBy("uploadedAt", "desc")
    .limit(isFullDetails ? 3 : MAX_VAULT_RECORDS)
    .get();

  const records = await Promise.all(
    snap.docs.map(async (doc) => {
      const d = doc.data();
      const url = await signed(d.path as string | undefined);
      return {
        id: doc.id,
        type: d.type as string,
        date: d.date as string,
        hospital: d.hospital as string,
        contentType: d.contentType as string,
        size: d.size as number,
        uploadedAt: (d.uploadedAt as { toDate?: () => Date })
          ?.toDate?.()
          ?.toISOString(),
        url, // 5-min signed URL
      };
    })
  );

  return NextResponse.json(
    { records, total: snap.size, limited: isFullDetails },
    { headers: noStoreHeaders() }
  );
}

/** POST /api/vault — create vault record metadata after upload confirmed */
export async function POST(req: NextRequest) {
  const feature = await requireFeature("recordsVault");
  if (!feature) {
    return NextResponse.json(
      { error: "Feature not available", code: "FEATURE_OFF" },
      { status: 404, headers: noStoreHeaders() }
    );
  }

  const profileId = await getProfileId(req);
  if (!profileId) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: noStoreHeaders() }
    );
  }

  const db = getAdminDb();

  // Check count limit
  const countSnap = await db
    .collection("profiles")
    .doc(profileId)
    .collection(VAULT_COLLECTION)
    .count()
    .get();
  const count = countSnap.data().count;
  if (count >= MAX_VAULT_RECORDS) {
    return NextResponse.json(
      { error: `Maximum ${MAX_VAULT_RECORDS} records allowed` },
      { status: 400, headers: noStoreHeaders() }
    );
  }

  const body = await req.json();
  const type = String(body.type || "other") as VaultRecordType;
  const date = String(body.date || "").trim();
  const hospital = String(body.hospital || "").trim();
  const path = String(body.path || "").trim();
  const contentType = String(body.contentType || "").trim();
  const size = Number(body.size || 0);

  const allowed: VaultRecordType[] = [
    "discharge_summary",
    "lab_report",
    "prescription",
    "other",
  ];
  if (!allowed.includes(type)) {
    return NextResponse.json(
      { error: "Invalid type" },
      { status: 400, headers: noStoreHeaders() }
    );
  }
  if (!path || !contentType || size <= 0) {
    return NextResponse.json(
      { error: "Missing path, contentType, or size" },
      { status: 400, headers: noStoreHeaders() }
    );
  }

  // Log access
  await db.collection("accessLogs").add({
    health_id: null,
    profileId,
    mode: "vault_upload",
    path,
    at: FieldValue.serverTimestamp(),
  });

  const ref = await db
    .collection("profiles")
    .doc(profileId)
    .collection(VAULT_COLLECTION)
    .add({
      type,
      date: date || null,
      hospital: hospital || null,
      path,
      contentType,
      size,
      uploadedAt: FieldValue.serverTimestamp(),
    });

  return NextResponse.json(
    { id: ref.id, success: true },
    { headers: noStoreHeaders() }
  );
}
