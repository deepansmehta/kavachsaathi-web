import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { randomBytes } from "crypto";
import { getAdminDb } from "@/lib/firebase-admin";
import { noStoreHeaders } from "@/lib/forms/pdfCommon";
import {
  requireOwnerSession,
  requirePack2Feature,
} from "@/lib/patientEase/auth";
import {
  getSignedGetUrl,
  getSignedPutUrl,
  isStorageConfigured,
} from "@/lib/storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_FILES = 10;
const MAX_BYTES = 8 * 1024 * 1024;
const TYPES = ["proposal_form", "health_declaration", "policy_schedule"] as const;

/** PIN / profile only — never used by emergency or hospital modes */
export async function GET(req: NextRequest) {
  const feat = await requirePack2Feature("disclosureVault");
  if (!feat.ok) return feat.res;
  const sess = await requireOwnerSession(req);
  if (!sess.ok) return sess.res;
  if (sess.via !== "profile" && sess.via !== "full_details") {
    return NextResponse.json({ error: "PIN required" }, { status: 401 });
  }
  const db = getAdminDb();
  const snap = await db
    .collection("disclosure_vault")
    .where("profileId", "==", sess.profileId)
    .limit(MAX_FILES)
    .get();
  const items = [];
  for (const d of snap.docs) {
    const x = d.data();
    let url: string | null = null;
    if (x.path && isStorageConfigured()) {
      try {
        url = await getSignedGetUrl({ path: String(x.path), expiresMs: 5 * 60_000 });
      } catch {
        url = null;
      }
    }
    items.push({
      id: d.id,
      type: x.type,
      policyNo: x.policyNo || null,
      date: x.date || null,
      url,
      created_at: x.created_at || null,
    });
  }
  return NextResponse.json(
    { items, maxFiles: MAX_FILES, maxBytes: MAX_BYTES },
    { headers: noStoreHeaders() }
  );
}

export async function POST(req: NextRequest) {
  const feat = await requirePack2Feature("disclosureVault");
  if (!feat.ok) return feat.res;
  const sess = await requireOwnerSession(req);
  if (!sess.ok) return sess.res;
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "signed-put");
  const db = getAdminDb();

  if (action === "signed-put") {
    const existing = await db
      .collection("disclosure_vault")
      .where("profileId", "==", sess.profileId)
      .get();
    if (existing.size >= MAX_FILES) {
      return NextResponse.json(
        { error: `Max ${MAX_FILES} files` },
        { status: 400, headers: noStoreHeaders() }
      );
    }
    const type = String(body.type || "");
    if (!TYPES.includes(type as (typeof TYPES)[number])) {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }
    const contentType = String(body.contentType || "application/pdf");
    if (!/^(application\/pdf|image\/(jpeg|jpg|png))$/i.test(contentType)) {
      return NextResponse.json(
        { error: "PDF or JPG/PNG only" },
        { status: 400 }
      );
    }
    if (!isStorageConfigured()) {
      return NextResponse.json(
        { error: "Storage not configured" },
        { status: 503 }
      );
    }
    const ext = contentType.includes("pdf") ? "pdf" : "jpg";
    const path = `disclosure/${sess.profileId}/${randomBytes(8).toString("hex")}.${ext}`;
    const uploadUrl = await getSignedPutUrl({
      path,
      contentType,
      expiresMs: 10 * 60_000,
    });
    return NextResponse.json(
      {
        path,
        uploadUrl,
        headers: { "Content-Type": contentType },
        maxBytes: MAX_BYTES,
        type,
      },
      { headers: noStoreHeaders() }
    );
  }

  if (action === "confirm") {
    const path = String(body.path || "");
    const type = String(body.type || "");
    if (!path.startsWith(`disclosure/${sess.profileId}/`)) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }
    await db.collection("disclosure_vault").add({
      profileId: sess.profileId,
      health_id: sess.healthId,
      path,
      type,
      policyNo: body.policyNo ? String(body.policyNo).slice(0, 64) : null,
      date: body.date ? String(body.date).slice(0, 40) : null,
      created_at: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ ok: true }, { headers: noStoreHeaders() });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function DELETE(req: NextRequest) {
  const feat = await requirePack2Feature("disclosureVault");
  if (!feat.ok) return feat.res;
  const sess = await requireOwnerSession(req);
  if (!sess.ok) return sess.res;
  const body = await req.json().catch(() => ({}));
  const id = String(body.id || "");
  const db = getAdminDb();
  const ref = db.collection("disclosure_vault").doc(id);
  const snap = await ref.get();
  if (!snap.exists || snap.data()?.profileId !== sess.profileId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await ref.delete();
  return NextResponse.json({ ok: true }, { headers: noStoreHeaders() });
}
