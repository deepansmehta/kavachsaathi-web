import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { requireFeature } from "@/lib/features/server";
import { noStoreHeaders } from "@/lib/forms/pdfCommon";
import { generateAgentCode } from "@/lib/policy/agent";
import type { AgentRecord } from "@/lib/policy/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function verifyAgentToken(
  req: NextRequest
): Promise<{ uid: string; email: string } | NextResponse> {
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: noStoreHeaders() }
    );
  }
  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    return { uid: decoded.uid, email: (decoded.email || "").toLowerCase() };
  } catch {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: noStoreHeaders() }
    );
  }
}

async function uniqueAgentCode(
  db: FirebaseFirestore.Firestore
): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const code = generateAgentCode();
    const q = await db
      .collection("agents")
      .where("agentCode", "==", code)
      .limit(1)
      .get();
    if (q.empty) return code;
  }
  throw new Error("Could not generate unique agent code");
}

/**
 * POST /api/agent/register — Firebase Auth agent self-registration.
 * Body: { name, phone, company, agencyCode?, city }
 */
export async function POST(req: NextRequest) {
  const feature = await requireFeature("agentConnect");
  if (!feature) {
    return NextResponse.json(
      { error: "Feature not available", code: "FEATURE_OFF" },
      { status: 404, headers: noStoreHeaders() }
    );
  }

  const auth = await verifyAgentToken(req);
  if (auth instanceof NextResponse) return auth;

  const db = getAdminDb();
  const existing = await db.collection("agents").doc(auth.uid).get();
  if (existing.exists) {
    return NextResponse.json(
      { agent: existing.data() as AgentRecord, alreadyRegistered: true },
      { headers: noStoreHeaders() }
    );
  }

  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  const phone = String(body.phone || "").trim();
  const company = String(body.company || "").trim();
  const city = String(body.city || "").trim();
  const agencyCode = body.agencyCode ? String(body.agencyCode).trim() : null;

  if (!name || !phone || !company || !city) {
    return NextResponse.json(
      { error: "name, phone, company and city are required" },
      { status: 400, headers: noStoreHeaders() }
    );
  }

  const agentCode = await uniqueAgentCode(db);
  const now = new Date().toISOString();
  const record: AgentRecord = {
    id: auth.uid,
    uid: auth.uid,
    agentCode,
    name,
    phone,
    company,
    agencyCode,
    city,
    status: "pending",
    pushOptIn: false,
    fcmToken: null,
    email: auth.email,
    createdAt: now,
    updatedAt: now,
  };

  await db.collection("agents").doc(auth.uid).set(record);

  return NextResponse.json({ agent: record }, { headers: noStoreHeaders() });
}
