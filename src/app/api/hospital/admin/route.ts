import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireFeature } from "@/lib/features/server";
import { getAdminDb, getAdminAuth } from "@/lib/firebase-admin";
import { noStoreHeaders } from "@/lib/forms/pdfCommon";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function adminEmails(): Set<string> {
  const raw =
    process.env.ADMIN_EMAILS ||
    "gdmtechnoworld@gmail.com,mehtadeepansh6@gmail.com";
  return new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

async function requireAdmin(req: NextRequest): Promise<{ email: string } | null> {
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return null;
  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    const email = (decoded.email || "").toLowerCase();
    if (!email || !adminEmails().has(email)) return null;
    return { email };
  } catch {
    return null;
  }
}

/** GET /api/hospital/admin — list all hospitals */
export async function GET(req: NextRequest) {
  const feature = await requireFeature("hospitalPortal");
  if (!feature) {
    return NextResponse.json(
      { error: "Feature not available", code: "FEATURE_OFF" },
      { status: 404, headers: noStoreHeaders() }
    );
  }

  const admin = await requireAdmin(req);
  if (!admin) {
    return NextResponse.json(
      { error: "Admin authorization required" },
      { status: 403, headers: noStoreHeaders() }
    );
  }

  const db = getAdminDb();
  const snap = await db.collection("hospitals").orderBy("name").get();
  const hospitals = snap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  return NextResponse.json({ hospitals }, { headers: noStoreHeaders() });
}

/** POST /api/hospital/admin — create or update hospital */
export async function POST(req: NextRequest) {
  const feature = await requireFeature("hospitalPortal");
  if (!feature) {
    return NextResponse.json(
      { error: "Feature not available", code: "FEATURE_OFF" },
      { status: 404, headers: noStoreHeaders() }
    );
  }

  const admin = await requireAdmin(req);
  if (!admin) {
    return NextResponse.json(
      { error: "Admin authorization required" },
      { status: 403, headers: noStoreHeaders() }
    );
  }

  const body = await req.json();
  const action = String(body.action || "create");

  const db = getAdminDb();

  if (action === "create") {
    const name = String(body.name || "").trim();
    const type = String(body.type || "private").trim();
    const city = String(body.city || "").trim();
    const staffEmails = (Array.isArray(body.staffEmails) ? body.staffEmails : [])
      .map((e: unknown) => String(e).trim().toLowerCase())
      .filter(Boolean);

    if (!name || !city) {
      return NextResponse.json(
        { error: "Name and city required" },
        { status: 400, headers: noStoreHeaders() }
      );
    }

    // Create Firebase Auth accounts for staff emails
    const auth = getAdminAuth();
    const createdEmails: string[] = [];
    for (const email of staffEmails) {
      try {
        // Try to get existing user
        await auth.getUserByEmail(email);
        createdEmails.push(email);
      } catch {
        // User doesn't exist — create with temp password
        const tempPass = `KvS_${Math.random().toString(36).slice(2, 10)}`;
        try {
          await auth.createUser({ email, password: tempPass });
          createdEmails.push(email);
        } catch {
          // ignore individual failures
        }
      }
    }

    const ref = await db.collection("hospitals").add({
      name,
      type,
      city,
      staffEmails,
      verified: true,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: admin.email,
    });

    return NextResponse.json(
      { id: ref.id, success: true, staffAccountsCreated: createdEmails },
      { headers: noStoreHeaders() }
    );
  }

  if (action === "update") {
    const id = String(body.id || "").trim();
    if (!id) {
      return NextResponse.json(
        { error: "Hospital ID required" },
        { status: 400, headers: noStoreHeaders() }
      );
    }
    const patch: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
    if (body.name) patch.name = String(body.name).trim();
    if (body.type) patch.type = String(body.type).trim();
    if (body.city) patch.city = String(body.city).trim();
    if (Array.isArray(body.staffEmails)) {
      patch.staffEmails = body.staffEmails
        .map((e: unknown) => String(e).trim().toLowerCase())
        .filter(Boolean);
    }
    if (typeof body.verified === "boolean") patch.verified = body.verified;
    await db.collection("hospitals").doc(id).update(patch);
    return NextResponse.json({ success: true }, { headers: noStoreHeaders() });
  }

  if (action === "delete") {
    const id = String(body.id || "").trim();
    if (!id) {
      return NextResponse.json(
        { error: "Hospital ID required" },
        { status: 400, headers: noStoreHeaders() }
      );
    }
    await db.collection("hospitals").doc(id).delete();
    return NextResponse.json({ success: true }, { headers: noStoreHeaders() });
  }

  return NextResponse.json(
    { error: "Unknown action" },
    { status: 400, headers: noStoreHeaders() }
  );
}
