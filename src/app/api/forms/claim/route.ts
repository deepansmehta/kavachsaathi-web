import { NextRequest } from "next/server";
import { requireFeature } from "@/lib/features/server";
import { requireFormSession } from "@/lib/forms/downloadService";
import { getAdminDb } from "@/lib/firebase-admin";
import { findCardByHealthId } from "@/lib/cardsRepo";
import { decrypt, hasEncKey } from "@/lib/crypto";
import { noStoreHeaders, blank, ageFromDob } from "@/lib/forms/pdfCommon";
import { buildClaimFormPdf, claimFormFilename, type ClaimPrefillFields } from "@/lib/forms/claimPdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function safeDecrypt(enc: unknown): string {
  if (!enc || typeof enc !== "string") return "";
  if (!hasEncKey()) return "";
  try { return blank(decrypt(enc)); } catch { return ""; }
}

async function loadProfile(healthId: string) {
  const db = getAdminDb();
  const card = await findCardByHealthId(db, healthId);
  if (card?.linkedProfileId) {
    const snap = await db.collection("profiles").doc(card.linkedProfileId).get();
    if (snap.exists) return snap.data()!;
  }
  const q = await db.collection("profiles").where("health_id", "==", healthId).limit(1).get();
  if (q.empty) return null;
  return q.docs[0].data();
}

function buildFields(d: Record<string, unknown>): ClaimPrefillFields {
  const ins = d.insurance as Record<string, unknown> | undefined;
  const priv = ins?.private as Record<string, unknown> | undefined;
  const om = ins?.otherMediclaim as Record<string, unknown> | undefined;
  const addr = d.address as Record<string, unknown> | undefined;
  const fd = d.family_doctor as { name?: string; phone?: string } | null;

  const dob = blank(d.dateOfBirth || d.dob);
  const age = ageFromDob(dob);

  const addrLine = safeDecrypt(addr?.lineEnc) || blank(d.fullAddress);
  const addrParts = [addrLine, blank(addr?.city || d.city), blank(addr?.state), blank(addr?.pincode)].filter(Boolean);

  const otherYes: boolean | null =
    om && typeof om.hasOther === "boolean" ? Boolean(om.hasOther) :
    om?.companyName ? true : null;

  const hasFp: boolean | null =
    d.hasFamilyPhysician === true ? true :
    d.hasFamilyPhysician === false ? false : null;

  return {
    patientName: blank(d.full_name),
    gender: blank(d.gender),
    ageYears: age.years,
    ageMonths: age.months,
    dateOfBirth: blank(dob),
    contact: blank(d.phone),
    alternateContact: blank(d.alternateContact),
    currentAddress: addrParts.join(", "),
    occupation: blank(d.occupation),
    insurerName: blank(priv?.insurerName),
    policyNumber: safeDecrypt(priv?.policyNumberEnc),
    policyHolderName: blank(priv?.policyHolderName),
    memberId: safeDecrypt(priv?.memberIdEnc),
    tpaName: blank(priv?.tpaName),
    isGroupPolicy: Boolean(priv?.isGroupPolicy),
    corporateName: blank(priv?.corporateName),
    employeeId: safeDecrypt(priv?.employeeIdEnc),
    familyPhysicianName: blank(d.familyDoctorName || fd?.name),
    familyPhysicianContact: blank(d.familyDoctorPhone || fd?.phone),
    familyPhysicianYes: hasFp,
    otherInsuranceYes: otherYes,
    otherCompany: blank(om?.companyName),
    otherPolicyDetails: safeDecrypt(om?.policyNumberEnc),
  };
}

/** GET /api/forms/claim — pre-filled IRDAI reimbursement claim Part A (PIN scope only) */
export async function GET(req: NextRequest) {
  const feature = await requireFeature("claimFormPrefill");
  if (!feature) {
    return Response.json(
      { error: "Feature not available", code: "FEATURE_OFF" },
      { status: 404, headers: noStoreHeaders() }
    );
  }

  const session = await requireFormSession(req);
  if (!session.ok) {
    return Response.json(
      { error: session.error, code: session.code },
      { status: session.status, headers: noStoreHeaders() }
    );
  }
  if (session.scope !== "pin") {
    return Response.json(
      { error: "Claim form requires patient/family PIN access", code: "FORBIDDEN_SCOPE" },
      { status: 403, headers: noStoreHeaders() }
    );
  }

  const profileData = await loadProfile(session.healthId);
  if (!profileData) {
    return Response.json(
      { error: "Profile not found" },
      { status: 404, headers: noStoreHeaders() }
    );
  }

  const fields = buildFields(profileData);
  const { bytes } = await buildClaimFormPdf(fields);

  return new Response(Buffer.from(bytes), {
    status: 200,
    headers: {
      ...noStoreHeaders(),
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${claimFormFilename()}"`,
    },
  });
}
