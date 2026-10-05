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
    raw.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)
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

/** GET /api/org — org admin: serial activation data only, never health data */
export async function GET(req: NextRequest) {
  const feature = await requireFeature("orgDashboard");
  if (!feature) {
    return NextResponse.json(
      { error: "Feature not available", code: "FEATURE_OFF" },
      { status: 404, headers: noStoreHeaders() }
    );
  }

  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) {
    return NextResponse.json(
      { error: "Authorization required" },
      { status: 401, headers: noStoreHeaders() }
    );
  }

  let callerEmail = "";
  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    callerEmail = (decoded.email || "").toLowerCase();
  } catch {
    return NextResponse.json(
      { error: "Invalid token" },
      { status: 401, headers: noStoreHeaders() }
    );
  }

  const db = getAdminDb();
  // Find org where callerEmail is an admin
  const q = await db
    .collection("orgs")
    .where("adminEmails", "array-contains", callerEmail)
    .limit(5)
    .get();

  if (q.empty) {
    return NextResponse.json(
      { error: "No org found for this account" },
      { status: 403, headers: noStoreHeaders() }
    );
  }

  // Support multiple orgs (use first, or query param orgId)
  const orgIdParam = req.nextUrl.searchParams.get("orgId");
  let orgDoc = orgIdParam
    ? q.docs.find((d) => d.id === orgIdParam)
    : q.docs[0];
  if (!orgDoc) orgDoc = q.docs[0];

  const orgData = orgDoc.data();
  const serialRanges = (orgData.serialRanges as string[] | undefined) ?? [];

  if (!serialRanges.length) {
    return NextResponse.json(
      {
        org: { id: orgDoc.id, name: orgData.name, type: orgData.type },
        cards: [],
        // Safety assertion: no health data
        _assertion: "No health data included",
      },
      { headers: noStoreHeaders() }
    );
  }

  // Query cards in org's serial ranges
  const cardsSnap = await db
    .collection("cards")
    .where("serial", "in", serialRanges.slice(0, 10))
    .get();

  // Only return serial, activated, activationDate — never health data
  const cards = cardsSnap.docs.map((doc) => {
    const d = doc.data();
    const activated = d.status === "activated";
    return {
      serial: d.serial,
      activated,
      activationDate: activated
        ? (d.activatedAt as { toDate?: () => Date })?.toDate?.()?.toISOString() ?? null
        : null,
      // Safety assertion: no health data included
    } satisfies { serial: string | null; activated: boolean; activationDate: string | null };
  });

  return NextResponse.json(
    {
      org: {
        id: orgDoc.id,
        name: orgData.name,
        type: orgData.type,
        serialRanges,
      },
      cards,
      _assertion: "Response contains serial, activated, activationDate only. No health data.",
    },
    { headers: noStoreHeaders() }
  );
}

/** POST /api/org — admin: create / update org */
export async function POST(req: NextRequest) {
  const feature = await requireFeature("orgDashboard");
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
    const type = String(body.type || "corporate").trim();
    const adminEmails_ = (Array.isArray(body.adminEmails) ? body.adminEmails : [])
      .map((e: unknown) => String(e).trim().toLowerCase())
      .filter(Boolean);
    const serialRanges = (Array.isArray(body.serialRanges) ? body.serialRanges : [])
      .map((s: unknown) => String(s).trim())
      .filter(Boolean);

    if (!name) {
      return NextResponse.json(
        { error: "Name required" },
        { status: 400, headers: noStoreHeaders() }
      );
    }

    const ref = await db.collection("orgs").add({
      name,
      type,
      adminEmails: adminEmails_,
      serialRanges,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: admin.email,
    });

    return NextResponse.json(
      { id: ref.id, success: true },
      { headers: noStoreHeaders() }
    );
  }

  if (action === "update") {
    const id = String(body.id || "").trim();
    if (!id) return NextResponse.json({ error: "Org ID required" }, { status: 400 });
    const patch: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
    if (body.name) patch.name = String(body.name).trim();
    if (body.type) patch.type = String(body.type).trim();
    if (Array.isArray(body.adminEmails)) {
      patch.adminEmails = body.adminEmails.map((e: unknown) => String(e).trim().toLowerCase()).filter(Boolean);
    }
    if (Array.isArray(body.serialRanges)) {
      patch.serialRanges = body.serialRanges.map((s: unknown) => String(s).trim()).filter(Boolean);
    }
    await db.collection("orgs").doc(id).update(patch);
    return NextResponse.json({ success: true }, { headers: noStoreHeaders() });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
