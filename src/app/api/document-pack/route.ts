/**
 * F16 — Document Pack PDF API
 * POST — generate and return multi-section PDF (no storage, rate-limited 10/hr)
 */

import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireFeature } from "@/lib/features/server";
import {
  PROFILE_SESSION_COOKIE,
  verifyProfileSessionToken,
} from "@/lib/profileSession";
import { getAdminDb } from "@/lib/firebase-admin";
import { decrypt, hasEncKey } from "@/lib/crypto";
import { noStoreHeaders } from "@/lib/forms/pdfCommon";
import {
  validateSections,
  checkDocPackRateLimit,
  type DocumentPackSection,
} from "@/lib/patientEase/documentPack";
import { buildDocumentPackPdf } from "@/lib/patientEase/pdfs/documentPackPdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function safeDec(enc: unknown): string {
  if (!enc || typeof enc !== "string" || !hasEncKey()) return "";
  try {
    return decrypt(enc);
  } catch {
    return "";
  }
}

async function getProfileId(req: NextRequest): Promise<string | null> {
  const tok = req.cookies.get(PROFILE_SESSION_COOKIE)?.value;
  const sess = verifyProfileSessionToken(tok);
  if (!sess) return null;
  const db = getAdminDb();
  const snap = await db.collection("profiles").doc(sess.profileId).get();
  if (!snap.exists) return null;
  return sess.profileId;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const flags = await requireFeature("documentPack");
  if (!flags) {
    return NextResponse.json(
      { error: "Feature not available", code: "FEATURE_OFF" },
      { status: 404 }
    );
  }

  const profileId = await getProfileId(req);
  if (!profileId) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401, headers: noStoreHeaders() });
  }

  // Rate limit: 10 per hour per profileId
  const rateCheck = checkDocPackRateLimit(profileId);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      {
        error: "Too many requests",
        code: "RATE_LIMIT",
        retryAfterMs: rateCheck.retryAfterMs,
      },
      {
        status: 429,
        headers: {
          ...noStoreHeaders(),
          "Retry-After": String(Math.ceil(rateCheck.retryAfterMs / 1000)),
        },
      }
    );
  }

  let body: { sections?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const sections = validateSections(body.sections);
  if (!sections) {
    return NextResponse.json(
      { error: "sections must be a non-empty array of valid section keys" },
      { status: 400 }
    );
  }

  // Load profile data
  const db = getAdminDb();
  const profileSnap = await db.collection("profiles").doc(profileId).get();
  if (!profileSnap.exists) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }
  const pd = profileSnap.data()!;

  // Build insurance with decrypted policy numbers (for display only)
  const ins = pd.insurance;
  let insuranceData: Record<string, unknown> | undefined;
  if (ins) {
    insuranceData = {
      coverageType: ins.coverageType || "",
      private: ins.private
        ? {
            insurerName: ins.private.insurerName || "",
            policyNumber: safeDec(ins.private.policyNumberEnc),
            validTill: ins.private.validTill || "",
            tpaName: ins.private.tpaName || "",
          }
        : undefined,
      government: ins.government
        ? {
            schemeName: ins.government.schemeName || "",
            govtCardNumber: safeDec(ins.government.govtCardNumberEnc),
          }
        : undefined,
    };
  }

  const profile = {
    name: pd.name || "",
    dob: pd.dob || "",
    gender: pd.gender || "",
    bloodGroup: pd.bloodGroup || pd.blood_group || "",
    phone: pd.phone || "",
    address: pd.address || "",
    aadhaar: "", // We only mask — never show raw Aadhaar in pack
    emergencyContacts: Array.isArray(pd.emergencyContacts) ? pd.emergencyContacts : [],
    conditions: Array.isArray(pd.conditions) ? pd.conditions : [],
    allergies: Array.isArray(pd.allergies) ? pd.allergies : [],
    medications: Array.isArray(pd.medications) ? pd.medications : [],
    insurance: insuranceData,
    donorDirective: pd.donorDirective || undefined,
    coverageSnapshot: pd.coverageSnapshot || undefined,
    healthId: pd.health_id || pd.healthId || "",
  };

  const healthId = String(pd.health_id || pd.healthId || "");

  // Log pack generation (no PDF stored)
  try {
    await db.collection("document_pack_logs").add({
      profileId,
      healthId,
      sections,
      generatedAt: FieldValue.serverTimestamp(),
      ua: req.headers.get("user-agent") || "",
    });
  } catch {
    // Non-fatal — log failure should not block PDF delivery
  }

  let pdfResult: { bytes: Uint8Array; headers: Record<string, string> };
  try {
    pdfResult = await buildDocumentPackPdf({
      sections: sections as DocumentPackSection[],
      profile,
      healthId,
    });
  } catch (err) {
    console.error("[document-pack] PDF generation error:", err);
    return NextResponse.json({ error: "PDF generation failed" }, { status: 500 });
  }

  return new NextResponse(Buffer.from(pdfResult.bytes), {
    status: 200,
    headers: pdfResult.headers,
  });
}
