/**
 * GET  /api/doctor-summary          → JSON summary
 * POST /api/doctor-summary?action=pdf → PDF download
 *
 * Auth: profile session (owner) OR full-details PIN session.
 */
import { NextRequest, NextResponse } from "next/server";
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
import { noStoreHeaders } from "@/lib/forms/pdfCommon";
import { buildDoctorSummary } from "@/lib/patientEase/doctorSummary";
import { buildDoctorSummaryPdf } from "@/lib/patientEase/pdfs/doctorSummaryPdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function resolveProfileData(
  req: NextRequest
): Promise<Record<string, unknown> | null> {
  const db = getAdminDb();

  // Try full-details PIN session first
  const fdToken = req.cookies.get(FULL_DETAILS_COOKIE)?.value;
  const fdSession = verifyFullDetailsToken(fdToken);
  if (fdSession?.scope === "pin") {
    const q = await db
      .collection("profiles")
      .where("health_id", "==", fdSession.healthId)
      .limit(1)
      .get();
    if (!q.empty) return q.docs[0].data() as Record<string, unknown>;
  }

  // Fall back to profile session
  const tok = req.cookies.get(PROFILE_SESSION_COOKIE)?.value;
  const sess = verifyProfileSessionToken(tok);
  if (!sess) return null;
  const snap = await db.collection("profiles").doc(sess.profileId).get();
  if (!snap.exists) return null;
  return snap.data() as Record<string, unknown>;
}

export async function GET(req: NextRequest) {
  const flags = await requireFeature("doctorSummary");
  if (!flags) {
    return NextResponse.json(
      { error: "Feature not available", code: "FEATURE_OFF" },
      { status: 404, headers: noStoreHeaders() }
    );
  }

  const profileData = await resolveProfileData(req);
  if (!profileData) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: noStoreHeaders() }
    );
  }

  const summary = buildDoctorSummary(profileData);
  return NextResponse.json({ summary }, { headers: noStoreHeaders() });
}

export async function POST(req: NextRequest) {
  const flags = await requireFeature("doctorSummary");
  if (!flags) {
    return NextResponse.json(
      { error: "Feature not available", code: "FEATURE_OFF" },
      { status: 404, headers: noStoreHeaders() }
    );
  }

  const action = req.nextUrl.searchParams.get("action");
  if (action !== "pdf") {
    return NextResponse.json(
      { error: "Unknown action. Use ?action=pdf" },
      { status: 400, headers: noStoreHeaders() }
    );
  }

  const profileData = await resolveProfileData(req);
  if (!profileData) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: noStoreHeaders() }
    );
  }

  try {
    const summary = buildDoctorSummary(profileData);
    const pdfBuffer = await buildDoctorSummaryPdf(summary);
    const name = `kavachsaathi-doctor-summary.pdf`;
    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${name}"`,
        ...noStoreHeaders(),
      },
    });
  } catch (err) {
    console.error("doctor-summary pdf", err);
    return NextResponse.json(
      { error: "PDF generation failed" },
      { status: 500, headers: noStoreHeaders() }
    );
  }
}
