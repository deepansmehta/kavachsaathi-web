import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, writeAdminLog } from "@/lib/adminAuth";
import { getAdminDb } from "@/lib/firebase-admin";
import { noStoreHeaders } from "@/lib/forms/pdfCommon";
import type { AgentRecord, AgentStatus } from "@/lib/policy/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/admin/agents?status=pending|approved — list agents */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (admin instanceof NextResponse) return admin;

  try {
    const db = getAdminDb();
    const statusFilter = (req.nextUrl.searchParams.get("status") || "")
      .trim()
      .toLowerCase();

    const snap = await db.collection("agents").get();
    let agents = snap.docs.map((d) => d.data() as AgentRecord);

    if (statusFilter === "pending" || statusFilter === "approved") {
      agents = agents.filter((a) => a.status === statusFilter);
    }

    agents.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

    return NextResponse.json(
      {
        agents,
        pendingCount: agents.filter((a) => a.status === "pending").length,
      },
      { headers: noStoreHeaders() }
    );
  } catch (err) {
    console.error("admin/agents GET", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 500, headers: noStoreHeaders() }
    );
  }
}

/**
 * POST /api/admin/agents — approve/reject an agent.
 * Body: { action: "approve" | "reject" | "suspend", agentId }
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (admin instanceof NextResponse) return admin;

  try {
    const db = getAdminDb();
    const body = await req.json();
    const action = String(body.action || "");
    const agentId = String(body.agentId || body.uid || "").trim();

    if (!agentId) {
      return NextResponse.json(
        { error: "agentId required" },
        { status: 400, headers: noStoreHeaders() }
      );
    }

    const ref = db.collection("agents").doc(agentId);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json(
        { error: "Agent not found" },
        { status: 404, headers: noStoreHeaders() }
      );
    }

    if (action === "approve" || action === "reject" || action === "suspend") {
      const status: AgentStatus = action === "approve" ? "approved" : "pending";
      await ref.update({
        status,
        updatedAt: new Date().toISOString(),
        ...(action !== "approve" ? { suspendedReason: action } : {}),
      });
      await writeAdminLog(db, {
        action: `agent_${action}`,
        byEmail: admin.email,
        meta: { agentId },
      });
      const updated = await ref.get();
      return NextResponse.json(
        { success: true, agent: updated.data() as AgentRecord },
        { headers: noStoreHeaders() }
      );
    }

    return NextResponse.json(
      { error: "Unknown action" },
      { status: 400, headers: noStoreHeaders() }
    );
  } catch (err) {
    console.error("admin/agents POST", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 500, headers: noStoreHeaders() }
    );
  }
}
