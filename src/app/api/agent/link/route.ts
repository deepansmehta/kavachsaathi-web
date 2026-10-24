import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireFeature } from "@/lib/features/server";
import {
  PROFILE_SESSION_COOKIE,
  verifyProfileSessionToken,
} from "@/lib/profileSession";
import { getAdminDb } from "@/lib/firebase-admin";
import { normalizePin, verifyPin } from "@/lib/pin";
import { noStoreHeaders } from "@/lib/forms/pdfCommon";
import { readPoliciesFromProfile } from "@/lib/policy/cryptoPolicy";
import { isValidAgentCode, normalizeAgentCode } from "@/lib/policy/agent";
import type { AgentRecord, PolicyAgentLink } from "@/lib/policy/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function policyAgentCodes(policies: { agent: PolicyAgentLink | null }[]): string[] {
  const codes = new Set<string>();
  for (const p of policies) {
    if (p.agent?.agentCode) codes.add(p.agent.agentCode);
  }
  return Array.from(codes);
}

/**
 * POST /api/agent/link — customer links/unlinks an agent on one of their
 * policies, gated by their own PIN. Body: { policyId, pin, action, agentCode? }
 */
export async function POST(req: NextRequest) {
  const feature = await requireFeature("agentConnect");
  if (!feature) {
    return NextResponse.json(
      { error: "Feature not available", code: "FEATURE_OFF" },
      { status: 404, headers: noStoreHeaders() }
    );
  }

  const tok = req.cookies.get(PROFILE_SESSION_COOKIE)?.value;
  const sess = verifyProfileSessionToken(tok);
  if (!sess) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: noStoreHeaders() }
    );
  }

  const db = getAdminDb();
  const snap = await db.collection("profiles").doc(sess.profileId).get();
  if (!snap.exists) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: noStoreHeaders() }
    );
  }
  const data = snap.data() as Record<string, unknown>;

  const body = await req.json().catch(() => ({}));
  const policyId = String(body.policyId || "").trim();
  const action = String(body.action || "") as "link" | "unlink";
  const pin = normalizePin(body.pin);

  if (!policyId || (action !== "link" && action !== "unlink")) {
    return NextResponse.json(
      { error: "policyId and a valid action (link|unlink) are required" },
      { status: 400, headers: noStoreHeaders() }
    );
  }

  const pinOk = await verifyPin(pin, data.pin_hash as string | undefined);
  if (!pinOk) {
    return NextResponse.json(
      { error: "Incorrect PIN" },
      { status: 403, headers: noStoreHeaders() }
    );
  }

  const policies = readPoliciesFromProfile(data);
  const idx = policies.findIndex((p) => p.id === policyId);
  if (idx < 0) {
    return NextResponse.json(
      { error: "Policy not found" },
      { status: 404, headers: noStoreHeaders() }
    );
  }
  const policy = policies[idx]!;

  if (action === "unlink") {
    policies[idx] = { ...policy, agent: null, updatedAt: new Date().toISOString() };
  } else {
    const agentCode = normalizeAgentCode(String(body.agentCode || ""));
    if (!isValidAgentCode(agentCode)) {
      return NextResponse.json(
        { error: "Invalid agent code" },
        { status: 400, headers: noStoreHeaders() }
      );
    }
    const agentQ = await db
      .collection("agents")
      .where("agentCode", "==", agentCode)
      .limit(1)
      .get();
    if (agentQ.empty) {
      return NextResponse.json(
        { error: "Agent code not found" },
        { status: 404, headers: noStoreHeaders() }
      );
    }
    const agent = agentQ.docs[0]!.data() as AgentRecord;
    if (agent.status !== "approved") {
      return NextResponse.json(
        { error: "Agent is not yet approved" },
        { status: 400, headers: noStoreHeaders() }
      );
    }
    policies[idx] = {
      ...policy,
      agent: { agentCode: agent.agentCode, name: agent.name, phone: agent.phone },
      updatedAt: new Date().toISOString(),
    };
  }

  const codes = policyAgentCodes(policies);

  await db.collection("profiles").doc(sess.profileId).update({
    policies,
    policyAgentCodes: codes,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json(
    { success: true, agent: policies[idx]!.agent },
    { headers: noStoreHeaders() }
  );
}
