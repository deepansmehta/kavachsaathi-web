import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { noStoreHeaders } from "@/lib/forms/pdfCommon";
import {
  requireOwnerSession,
  requirePack2Feature,
} from "@/lib/patientEase/auth";
import {
  DOC_PACK_SECTIONS,
  checkDocPackRateLimit,
  maskAadhaar,
} from "@/lib/patientEase/documentPack";
import { buildDocumentPackPdf } from "@/lib/patientEase/pdfs/documentPackPdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const feat = await requirePack2Feature("documentPack");
  if (!feat.ok) return feat.res;
  const sess = await requireOwnerSession(req);
  if (!sess.ok) return sess.res;

  const rate = checkDocPackRateLimit(sess.profileId);
  if (!rate.ok) {
    return NextResponse.json(
      { error: "Rate limit: max 10 document packs per hour", code: "RATE_LIMIT" },
      { status: 429, headers: noStoreHeaders() }
    );
  }

  const body = await req.json().catch(() => ({}));
  const wanted = Array.isArray(body.sections)
    ? body.sections.map(String)
    : DOC_PACK_SECTIONS.filter((s) => s.defaultOn).map((s) => s.id);

  const db = getAdminDb();
  const profile = await db.collection("profiles").doc(sess.profileId).get();
  const p = profile.data() || {};
  const insurance = (p.insurance || {}) as Record<string, unknown>;
  const priv = (insurance.private || {}) as Record<string, unknown>;
  const ids = Array.isArray(p.idProofs) ? p.idProofs : [];
  const aadhaar = ids.find(
    (x: { type?: string }) => String(x?.type || "").toLowerCase() === "aadhaar"
  ) as { number?: string } | undefined;

  const vaultSnap = await db
    .collection("vault")
    .where("profileId", "==", sess.profileId)
    .limit(10)
    .get()
    .catch(() => null);
  const vaultTitles =
    vaultSnap?.docs
      .map((d) => {
        const v = d.data();
        return `${v.type || "record"} ${v.date || ""} ${v.hospital || ""}`.trim();
      })
      .slice(0, 3) || [];

  const bytes = await buildDocumentPackPdf({
    name: String(p.full_name || ""),
    insurer: String(priv.insurerName || ""),
    tpa: String(priv.tpaName || ""),
    policy: String(priv.policyNumber || ""),
    memberId: String(priv.memberId || ""),
    aadhaarMasked: maskAadhaar(aadhaar?.number),
    sections: wanted,
    vaultTitles: wanted.includes("vault") ? vaultTitles : [],
  });

  await db.collection("document_pack_logs").add({
    profileId: sess.profileId,
    health_id: sess.healthId,
    sections: wanted,
    at: new Date().toISOString(),
    created_at: FieldValue.serverTimestamp(),
  });

  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      ...noStoreHeaders(),
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="kavach-document-pack.pdf"',
    },
  });
}
