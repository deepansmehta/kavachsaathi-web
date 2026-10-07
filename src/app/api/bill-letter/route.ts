/**
 * F17 — Bill Request Letter PDF API
 * POST — generate English + Hindi letter PDF + checklist page
 */

import { NextRequest, NextResponse } from "next/server";
import { requireFeature } from "@/lib/features/server";
import {
  PROFILE_SESSION_COOKIE,
  verifyProfileSessionToken,
} from "@/lib/profileSession";
import { getAdminDb } from "@/lib/firebase-admin";
import { noStoreHeaders } from "@/lib/forms/pdfCommon";
import { buildBillLetterPdf } from "@/lib/patientEase/pdfs/billLetterPdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
  const flags = await requireFeature("billRequestLetter");
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

  let body: {
    hospitalName?: string;
    admissionDate?: string;
    dischargeDate?: string;
    policyNumber?: string;
    tpaName?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.hospitalName) {
    return NextResponse.json({ error: "hospitalName is required" }, { status: 400 });
  }

  // Load profile for name + health_id
  const db = getAdminDb();
  const profileSnap = await db.collection("profiles").doc(profileId).get();
  if (!profileSnap.exists) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }
  const pd = profileSnap.data()!;

  const today = new Date();
  const generatedDate = today.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  let pdfResult: { bytes: Uint8Array; headers: Record<string, string> };
  try {
    pdfResult = await buildBillLetterPdf({
      patientName: pd.name || "Patient",
      hospitalName: body.hospitalName,
      admissionDate: body.admissionDate || "",
      dischargeDate: body.dischargeDate || "",
      healthId: pd.health_id || pd.healthId || "",
      policyNumber: body.policyNumber || "",
      tpaName: body.tpaName || "",
      generatedDate,
    });
  } catch (err) {
    console.error("[bill-letter] PDF generation error:", err);
    return NextResponse.json({ error: "PDF generation failed" }, { status: 500 });
  }

  return new NextResponse(Buffer.from(pdfResult.bytes), {
    status: 200,
    headers: pdfResult.headers,
  });
}
