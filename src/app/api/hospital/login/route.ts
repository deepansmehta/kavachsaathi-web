import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireFeature } from "@/lib/features/server";
import { getAdminDb, getAdminAuth } from "@/lib/firebase-admin";
import { noStoreHeaders } from "@/lib/forms/pdfCommon";
import {
  HOSPITAL_SESSION_COOKIE,
  SESSION_MAX_AGE,
  makeHospitalSessionToken,
} from "@/lib/hospitalSession";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** POST /api/hospital/login — verify Firebase ID token + create hospital session */
export async function POST(req: NextRequest) {
  const feature = await requireFeature("hospitalPortal");
  if (!feature) {
    return NextResponse.json(
      { error: "Feature not available", code: "FEATURE_OFF" },
      { status: 404, headers: noStoreHeaders() }
    );
  }

  const body = await req.json();
  const idToken = String(body.idToken || "").trim();
  if (!idToken) {
    return NextResponse.json(
      { error: "ID token required" },
      { status: 400, headers: noStoreHeaders() }
    );
  }

  let decoded: { email?: string; uid: string };
  try {
    decoded = await getAdminAuth().verifyIdToken(idToken);
  } catch {
    return NextResponse.json(
      { error: "Invalid or expired ID token" },
      { status: 401, headers: noStoreHeaders() }
    );
  }

  const email = (decoded.email || "").toLowerCase();
  if (!email) {
    return NextResponse.json(
      { error: "No email in token" },
      { status: 401, headers: noStoreHeaders() }
    );
  }

  const db = getAdminDb();
  const q = await db
    .collection("hospitals")
    .where("staffEmails", "array-contains", email)
    .limit(1)
    .get();
  if (q.empty) {
    return NextResponse.json(
      { error: "No hospital account found for this email" },
      { status: 403, headers: noStoreHeaders() }
    );
  }

  const hospitalDoc = q.docs[0];
  const hospitalId = hospitalDoc.id;
  const hospitalData = hospitalDoc.data();

  const token = makeHospitalSessionToken(hospitalId, email);

  await db.collection("accessLogs").add({
    mode: "hospital_login",
    hospitalId,
    hospitalName: hospitalData.name,
    staffEmail: email,
    at: FieldValue.serverTimestamp(),
  });

  const res = NextResponse.json(
    {
      success: true,
      hospitalId,
      hospitalName: hospitalData.name,
      email,
    },
    { headers: noStoreHeaders() }
  );
  res.cookies.set(HOSPITAL_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}

/** DELETE /api/hospital/login — logout */
export async function DELETE() {
  const res = NextResponse.json({ success: true }, { headers: noStoreHeaders() });
  res.cookies.set(HOSPITAL_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
