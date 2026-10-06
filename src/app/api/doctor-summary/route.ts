import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { noStoreHeaders } from "@/lib/forms/pdfCommon";
import {
  requireOwnerSession,
  requirePack2Feature,
} from "@/lib/patientEase/auth";
import { buildDoctorSummaryPdf } from "@/lib/patientEase/pdfs/doctorSummaryPdf";
import { loadFeatureFlags } from "@/lib/features/server";
import { isFeatureOn } from "@/lib/features/flags";
import { buildAutoSummaryPair } from "@/lib/autoSummary";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function loadSummary(profileId: string) {
  const db = getAdminDb();
  const snap = await db.collection("profiles").doc(profileId).get();
  const p = snap.data() || {};
  const flags = await loadFeatureFlags();
  const contacts = Array.isArray(p.emergency_contacts) ? p.emergency_contacts : [];
  const summaryPair = isFeatureOn(flags, "autoSummary")
    ? buildAutoSummaryPair({
        dateOfBirth: p.dateOfBirth as string,
        gender: p.gender as string,
        bloodGroup: String(p.blood_group || ""),
        criticalFlags: (p.criticalAlerts?.tags ||
          p.criticalFlags?.tags ||
          []) as string[],
        conditions: (p.chronic_conditions || []) as string[],
        medications: (p.medications || []) as string[],
        allergies: (p.allergies || []) as string[],
        emergencyContact: contacts[0] || null,
      })
    : { en: "", hi: "" };
  return {
    name: String(p.full_name || ""),
    bloodGroup: String(p.blood_group || ""),
    allergies: (p.allergies || []) as string[],
    criticalFlags: (p.criticalAlerts?.tags ||
      p.criticalFlags?.tags ||
      []) as string[],
    conditions: (p.conditionsDetailed ||
      (p.chronic_conditions || []).map((n: string) => ({ name: n }))) as {
      name: string;
      sinceYear?: string;
    }[],
    surgeries: (p.surgeries || []) as {
      name: string;
      year?: string;
      hospital?: string;
    }[],
    medicines: (p.medicinesDetailed ||
      (p.medications || []).map((n: string) => ({ name: n }))) as {
      name: string;
      dose?: string;
      frequency?: string;
    }[],
    vaccinations: (p.vaccinations || []) as { name: string; date?: string }[],
    familyDoctor: p.family_doctor || {
      name: p.familyDoctorName,
      phone: p.familyDoctorPhone,
    },
    includeJanAushadhi: isFeatureOn(flags, "janAushadhi"),
    autoSummaryEn: summaryPair.en || undefined,
    autoSummaryHi: summaryPair.hi || undefined,
  };
}

export async function GET(req: NextRequest) {
  const feat = await requirePack2Feature("doctorSummary");
  if (!feat.ok) return feat.res;
  const sess = await requireOwnerSession(req);
  if (!sess.ok) return sess.res;
  const data = await loadSummary(sess.profileId);
  const wantPdf = req.nextUrl.searchParams.get("format") === "pdf";
  if (!wantPdf) {
    return NextResponse.json({ summary: data }, { headers: noStoreHeaders() });
  }
  const bytes = await buildDoctorSummaryPdf(data);
  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      ...noStoreHeaders(),
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="doctor-summary.pdf"',
    },
  });
}
