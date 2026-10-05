import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireFeature } from "@/lib/features/server";
import {
  FULL_DETAILS_COOKIE,
  verifyFullDetailsToken,
} from "@/lib/fullDetailsSession";
import { getAdminDb } from "@/lib/firebase-admin";
import { findCardByHealthId } from "@/lib/cardsRepo";
import { noStoreHeaders } from "@/lib/forms/pdfCommon";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const IRDAI_TIMELINES = {
  preAuthDecision: "Pre-authorisation decision within 1 hour of receipt of request",
  enhancementDecision: "Enhancement decision within 30 minutes",
  finalDischargeAuth: "Final discharge authorisation within 3 hours",
  reference: "IRDAI Master Circular on Health Insurance – Cashless Facility 2024",
  referenceUrl: "https://irdai.gov.in",
};

const ESCALATION = {
  step1: "Submit written complaint to insurer's in-house Grievance Officer (resolve within 15 days)",
  step2: {
    name: "IRDAI Bima Bharosa (Integrated Grievance Management System)",
    url: "https://bimabharosa.irdai.gov.in",
    phone: "155255",
    note: "Toll-free; available 24×7",
  },
  step3: {
    name: "Insurance Ombudsman",
    url: "https://cioins.co.in",
    note: "Approach within 1 year of insurer rejection. Locate your regional office at cioins.co.in",
  },
};

async function loadProfile(healthId: string) {
  const db = getAdminDb();
  const card = await findCardByHealthId(db, healthId);
  if (card?.linkedProfileId) {
    const snap = await db
      .collection("profiles")
      .doc(card.linkedProfileId)
      .get();
    if (snap.exists)
      return { profileId: snap.id, ref: snap.ref, data: snap.data()! };
  }
  const q = await db
    .collection("profiles")
    .where("health_id", "==", healthId)
    .limit(1)
    .get();
  if (q.empty) return null;
  return { profileId: q.docs[0].id, ref: q.docs[0].ref, data: q.docs[0].data() };
}

/** POST /api/cashless-timer — store cashlessRequestAt timestamp (PIN scope only) */
export async function POST(req: NextRequest) {
  const feature = await requireFeature("cashlessTimer");
  if (!feature) {
    return NextResponse.json(
      { error: "Feature not available", code: "FEATURE_OFF" },
      { status: 404, headers: noStoreHeaders() }
    );
  }

  const token = req.cookies.get(FULL_DETAILS_COOKIE)?.value;
  const session = verifyFullDetailsToken(token);
  if (!session || session.scope !== "pin") {
    return NextResponse.json(
      { error: "PIN session required" },
      { status: 401, headers: noStoreHeaders() }
    );
  }

  const found = await loadProfile(session.healthId);
  if (!found) {
    return NextResponse.json(
      { error: "Profile not found" },
      { status: 404, headers: noStoreHeaders() }
    );
  }

  const now = new Date();
  await found.ref.update({ cashlessRequestAt: FieldValue.serverTimestamp() });

  const db = getAdminDb();
  const configSnap = await db.collection("config").doc("insurers").get();
  const insurersList =
    configSnap.exists
      ? ((configSnap.data()?.list as unknown[]) ?? [])
      : [];

  return NextResponse.json(
    {
      cashlessRequestAt: now.toISOString(),
      irdaiTimelines: IRDAI_TIMELINES,
      escalation: ESCALATION,
      insurers: insurersList,
      disclaimer: "Information only, not legal advice.",
    },
    { headers: noStoreHeaders() }
  );
}

/** GET /api/cashless-timer — read current timer state (PIN scope only) */
export async function GET(req: NextRequest) {
  const feature = await requireFeature("cashlessTimer");
  if (!feature) {
    return NextResponse.json(
      { error: "Feature not available", code: "FEATURE_OFF" },
      { status: 404, headers: noStoreHeaders() }
    );
  }

  const token = req.cookies.get(FULL_DETAILS_COOKIE)?.value;
  const session = verifyFullDetailsToken(token);
  if (!session || session.scope !== "pin") {
    return NextResponse.json(
      { error: "PIN session required" },
      { status: 401, headers: noStoreHeaders() }
    );
  }

  const found = await loadProfile(session.healthId);
  if (!found) {
    return NextResponse.json(
      { error: "Profile not found" },
      { status: 404, headers: noStoreHeaders() }
    );
  }

  const cashlessRequestAt = found.data.cashlessRequestAt as
    | { toDate?: () => Date }
    | null
    | undefined;
  const atIso = cashlessRequestAt?.toDate?.()?.toISOString() ?? null;

  const db = getAdminDb();
  const configSnap = await db.collection("config").doc("insurers").get();
  const insurersList =
    configSnap.exists
      ? ((configSnap.data()?.list as unknown[]) ?? [])
      : [];

  return NextResponse.json(
    {
      cashlessRequestAt: atIso,
      irdaiTimelines: IRDAI_TIMELINES,
      escalation: ESCALATION,
      insurers: insurersList,
      disclaimer: "Information only, not legal advice.",
    },
    { headers: noStoreHeaders() }
  );
}
