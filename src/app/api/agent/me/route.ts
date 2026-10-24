import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { requireFeature } from "@/lib/features/server";
import { noStoreHeaders } from "@/lib/forms/pdfCommon";
import type { AgentRecord } from "@/lib/policy/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function verifyAgentToken(
  req: NextRequest
): Promise<{ uid: string } | NextResponse> {
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
    return { uid: decoded.uid };
  } catch {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: noStoreHeaders() }
    );
  }
}

/** GET /api/agent/me — the signed-in agent's own record */
export async function GET(req: NextRequest) {
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
  const snap = await db.collection("agents").doc(auth.uid).get();
  if (!snap.exists) {
    return NextResponse.json(
      { error: "Not registered", code: "AGENT_NOT_FOUND" },
      { status: 404, headers: noStoreHeaders() }
    );
  }

  return NextResponse.json(
    { agent: snap.data() as AgentRecord },
    { headers: noStoreHeaders() }
  );
}

/**
 * PATCH /api/agent/me — update own profile fields.
 * Allowed: name, phone, company, city, pushOptIn, fcmToken.
 * agentCode and status are admin-controlled only.
 */
export async function PATCH(req: NextRequest) {
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
  const ref = db.collection("agents").doc(auth.uid);
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json(
      { error: "Not registered", code: "AGENT_NOT_FOUND" },
      { status: 404, headers: noStoreHeaders() }
    );
  }

  const body = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (body.name !== undefined) patch.name = String(body.name || "").trim();
  if (body.phone !== undefined) patch.phone = String(body.phone || "").trim();
  if (body.company !== undefined) patch.company = String(body.company || "").trim();
  if (body.city !== undefined) patch.city = String(body.city || "").trim();
  if (body.pushOptIn !== undefined) patch.pushOptIn = Boolean(body.pushOptIn);
  if (body.fcmToken !== undefined) {
    patch.fcmToken = body.fcmToken ? String(body.fcmToken).slice(0, 4096) : null;
  }

  await ref.update(patch);
  const updated = await ref.get();

  return NextResponse.json(
    { agent: updated.data() as AgentRecord },
    { headers: noStoreHeaders() }
  );
}
