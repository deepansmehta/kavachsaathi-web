import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireFeature } from "@/lib/features/server";
import { requireOwnerSession } from "@/lib/patientEase/auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { verifyPin } from "@/lib/pin";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import { noStoreHeaders } from "@/lib/forms/pdfCommon";
import {
  buildFhirBundle,
  validateFhirBundle,
  type FhirProfileSource,
} from "@/lib/fhir/buildBundle";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/profile/fhir-export
 * PIN required · 5/day · mode fhir_export · Cache-Control: no-store
 * Never includes Aadhaar.
 */
export async function POST(req: NextRequest) {
  const feature = await requireFeature("fhirExport");
  if (!feature) {
    return NextResponse.json(
      { error: "Feature not available", code: "FEATURE_OFF" },
      { status: 404, headers: noStoreHeaders() }
    );
  }

  try {
    const sess = await requireOwnerSession(req);
    if (!sess.ok) return sess.res;

    const body = await req.json().catch(() => ({}));
    const pin = String((body as { pin?: string }).pin || "");
    if (!/^\d{4,6}$/.test(pin)) {
      return NextResponse.json(
        { error: "PIN required (4–6 digits)" },
        { status: 400, headers: noStoreHeaders() }
      );
    }

    const db = getAdminDb();
    const ip = clientIp(req);
    const rl = await checkRateLimit({
      key: `fhir-export:${sess.profileId}:${ip}`,
      limit: 5,
      windowMs: 24 * 60 * 60_000,
      captchaAfter: 99,
      db,
    });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "FHIR export limit reached (5 per day)." },
        { status: 429, headers: noStoreHeaders() }
      );
    }

    const snap = await db.collection("profiles").doc(sess.profileId).get();
    if (!snap.exists) {
      return NextResponse.json(
        { error: "Not found" },
        { status: 404, headers: noStoreHeaders() }
      );
    }
    const d = snap.data()!;
    const ok = await verifyPin(pin, String(d.pin_hash || ""));
    if (!ok) {
      return NextResponse.json(
        { error: "Incorrect PIN" },
        { status: 401, headers: noStoreHeaders() }
      );
    }

    const insurance = d.insurance as FhirProfileSource["insurance"];
    const vaultSnap = await db
      .collection("profiles")
      .doc(sess.profileId)
      .collection("vault")
      .limit(20)
      .get()
      .catch(() => null);

    const src: FhirProfileSource = {
      health_id: String(d.health_id || sess.healthId),
      full_name: String(d.full_name || ""),
      gender: (d.gender as string) || null,
      dateOfBirth: (d.dateOfBirth as string) || null,
      phone: (d.phone as string) || null,
      address: (d.address as string) || null,
      city: (d.city as string) || null,
      state: (d.state as string) || null,
      pincode: (d.pincode as string) || null,
      abhaId: (d.abhaId as string) || null,
      blood_group: (d.blood_group as string) || null,
      allergies: Array.isArray(d.allergies) ? d.allergies : [],
      chronic_conditions: Array.isArray(d.chronic_conditions)
        ? d.chronic_conditions
        : [],
      medications: Array.isArray(d.medications) ? d.medications : [],
      emergency_contacts: Array.isArray(d.emergency_contacts)
        ? d.emergency_contacts
        : [],
      insurance: insurance || null,
      vaultRecords: vaultSnap
        ? vaultSnap.docs.map((doc) => {
            const v = doc.data();
            return {
              id: doc.id,
              title: String(v.title || v.name || "Record"),
              type: String(v.type || "document"),
              createdAt: v.createdAt?.toDate?.()?.toISOString?.() || undefined,
            };
          })
        : [],
    };

    const bundle = buildFhirBundle(src);
    const validation = validateFhirBundle(bundle);

    await db.collection("accessLogs").add({
      health_id: src.health_id,
      healthId: src.health_id,
      mode: "fhir_export",
      at: FieldValue.serverTimestamp(),
      profileId: sess.profileId,
    });

    return NextResponse.json(
      {
        success: true,
        bundle,
        validation,
        filename: `kavachsaathi-fhir-${src.health_id}.json`,
        note:
          "Real ABDM HIP/HIU integration needs NHA registration (future step). This export is ABDM-oriented FHIR R4 for personal/hospital use.",
      },
      { headers: noStoreHeaders() }
    );
  } catch (err) {
    console.error("fhir-export", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Export failed" },
      { status: 500, headers: noStoreHeaders() }
    );
  }
}
