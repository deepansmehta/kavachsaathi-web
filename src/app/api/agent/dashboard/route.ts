import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { requireFeature } from "@/lib/features/server";
import { noStoreHeaders } from "@/lib/forms/pdfCommon";
import { readPoliciesFromProfile } from "@/lib/policy/cryptoPolicy";
import { agentClientFromPolicy } from "@/lib/policy/agent";
import type { AgentClientView, AgentRecord } from "@/lib/policy/types";

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

function csvEscape(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

/**
 * GET /api/agent/dashboard?format=json|csv
 * Returns only AgentClientView fields for clients linked to this agent's
 * agentCode — never full names, policy numbers, phone numbers, or nominees.
 */
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
  const agentSnap = await db.collection("agents").doc(auth.uid).get();
  if (!agentSnap.exists) {
    return NextResponse.json(
      { error: "Not registered", code: "AGENT_NOT_FOUND" },
      { status: 404, headers: noStoreHeaders() }
    );
  }
  const agent = agentSnap.data() as AgentRecord;
  if (agent.status !== "approved") {
    return NextResponse.json(
      { error: "Agent account pending admin approval", code: "AGENT_PENDING" },
      { status: 403, headers: noStoreHeaders() }
    );
  }

  const profilesSnap = await db
    .collection("profiles")
    .where("policyAgentCodes", "array-contains", agent.agentCode)
    .get();

  const clients: AgentClientView[] = [];
  for (const doc of profilesSnap.docs) {
    const data = doc.data() as Record<string, unknown>;
    const holderName = String(data.full_name || data.name || "Member");
    const healthId = String(data.health_id || "");
    const policies = readPoliciesFromProfile(data);
    for (const policy of policies) {
      if (policy.agent?.agentCode === agent.agentCode) {
        clients.push(agentClientFromPolicy(holderName, healthId, policy));
      }
    }
  }

  const format = (req.nextUrl.searchParams.get("format") || "json").toLowerCase();
  if (format === "csv") {
    const header = [
      "firstName",
      "lastInitial",
      "cardIdMasked",
      "policyType",
      "insurerName",
      "endDate",
      "renewalStatus",
    ].join(",");
    const rows = clients.map((c) =>
      [
        csvEscape(c.firstName),
        csvEscape(c.lastInitial),
        csvEscape(c.cardIdMasked),
        csvEscape(c.policyType),
        csvEscape(c.insurerName),
        csvEscape(c.endDate || ""),
        csvEscape(c.renewalStatus),
      ].join(",")
    );
    return new NextResponse([header, ...rows].join("\n"), {
      status: 200,
      headers: {
        ...noStoreHeaders(),
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="kavachsaathi-agent-clients.csv"',
      },
    });
  }

  return NextResponse.json({ clients }, { headers: noStoreHeaders() });
}
