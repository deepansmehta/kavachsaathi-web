import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireFeature } from "@/lib/features/server";
import { getAdminDb, getAdminAuth } from "@/lib/firebase-admin";
import { noStoreHeaders } from "@/lib/forms/pdfCommon";
import { createHmac } from "crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HOSPITAL_SESSION_COOKIE = "kavach_hospital_session";
const SESSION_MAX_AGE = 8 * 60 * 60; // 8 hours

function sessionSecret() {
  return (
    process.env.PROFILE_SESSION_SECRET ||
    process.env.FIREBASE_ADMIN_PRIVATE_KEY?.slice(0, 64) ||
    "kavach-hospital-secret"
  );
}

export function makeHospitalSessionToken(hospitalId: string, email: string): string {
  const exp = Date.now() + SESSION_MAX_AGE * 1000;
  const payload = `${hospitalId}.${encodeURIComponent(email)}.${exp}`;
  const sig = createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyHospitalSessionToken(
  token: string | undefined | null
): { hospitalId: string; email: string } | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [hospitalId, emailEnc, expStr, sig] = parts;
  const exp = Number(expStr);
  if (!hospitalId || !emailEnc || !exp || Date.now() > exp) return null;
  const payload = `${hospitalId}.${emailEnc}.${expStr}`;
  const expected = createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
  try {
    const a = Buffer.from(sig), b = Buffer.from(expected);
    if (a.length !== b.length) return null;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
    if (diff !== 0) return null;
  } catch { return null; }
  return { hospitalId, email: decodeURIComponent(emailEnc) };
}

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
  // Find hospital where this email is a staff member
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

  // Log login
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

export { HOSPITAL_SESSION_COOKIE };
