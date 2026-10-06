import { NextRequest, NextResponse } from "next/server";
import { requireFeature } from "@/lib/features/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { noStoreHeaders } from "@/lib/forms/pdfCommon";
import {
  HOSPITAL_SESSION_COOKIE,
  verifyHospitalSessionToken,
} from "@/lib/hospitalSession";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getSession(req: NextRequest) {
  const tok = req.cookies.get(HOSPITAL_SESSION_COOKIE)?.value;
  return verifyHospitalSessionToken(tok);
}

/** GET /api/hospital — hospital dashboard: own access history only */
export async function GET(req: NextRequest) {
  const feature = await requireFeature("hospitalPortal");
  if (!feature) {
    return NextResponse.json(
      { error: "Feature not available", code: "FEATURE_OFF" },
      { status: 404, headers: noStoreHeaders() }
    );
  }

  const session = getSession(req);
  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized", code: "SESSION_EXPIRED" },
      { status: 401, headers: noStoreHeaders() }
    );
  }

  const db = getAdminDb();

  // Hospital info
  const hospitalSnap = await db
    .collection("hospitals")
    .doc(session.hospitalId)
    .get();
  if (!hospitalSnap.exists) {
    return NextResponse.json(
      { error: "Hospital not found" },
      { status: 404, headers: noStoreHeaders() }
    );
  }
  const hospitalData = hospitalSnap.data()!;

  // Access history for this hospital email only (never patient list)
  const logsSnap = await db
    .collection("accessLogs")
    .where("hospitalId", "==", session.hospitalId)
    .where("staffEmail", "==", session.email)
    .orderBy("at", "desc")
    .limit(50)
    .get();

  const logs = logsSnap.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      mode: d.mode,
      at: (d.at as { toDate?: () => Date })?.toDate?.()?.toISOString(),
      // NEVER include patient health_id or name in hospital dashboard
    };
  });

  return NextResponse.json(
    {
      hospital: {
        id: session.hospitalId,
        name: hospitalData.name,
        type: hospitalData.type,
        city: hospitalData.city,
        verified: hospitalData.verified === true,
      },
      email: session.email,
      logs,
    },
    { headers: noStoreHeaders() }
  );
}
