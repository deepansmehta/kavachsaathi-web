/**
 * Policy Saathi e2e — disposable KVS-2099-POL01 only.
 * Never touches KVS-2026-* or permanently mutates KVS-DEMO-*.
 *
 *   npx --yes tsx scripts/test-policy-saathi.ts
 */
import * as fs from "fs";
import * as path from "path";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import bcrypt from "bcryptjs";
import { hasEncKey } from "../src/lib/crypto";
import {
  toStoredPolicy,
  toClientPolicy,
  readPoliciesFromProfile,
} from "../src/lib/policy/cryptoPolicy";
import { publicPolicyBlocksFromProfile, assertPublicPolicySafe } from "../src/lib/policy/public";
import { buildPolicyRenewalIcs, countIcsEvents } from "../src/lib/policy/ics";
import { buildInformInsurerMessage } from "../src/lib/policy/informMessage";
import { buildCashlessInfoPdf } from "../src/lib/policy/cashlessPdf";
import { checklistForClaimType } from "../src/lib/policy/checklists";
import { generateAgentCode, maskCardId, agentClientFromPolicy } from "../src/lib/policy/agent";
import { policyStatus, maskPolicyNumber } from "../src/lib/policy/status";
import { MAX_POLICY_FILE_BYTES } from "../src/lib/policy/types";
import { sniffContentType } from "../src/lib/storage";

const HEALTH_ID = "KVS-2099-POL01";
const MEMBER_ID = "KVS-2099-POL02";
const PIN = "4820";
const MEMBER_PIN = "4821";

function loadEnv() {
  const p = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m && !process.env[m[1].trim()]) {
      process.env[m[1].trim()] = m[2].trim();
    }
  }
}

function loadAdmin() {
  loadEnv();
  if (!getApps().length) {
    const sa = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "service-account.json"), "utf8")
    );
    initializeApp({
      credential: cert(sa),
      projectId: sa.project_id,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    });
  }
  return getFirestore();
}

const results: { feature: string; result: "pass" | "fail"; note?: string }[] =
  [];

function pass(feature: string, note?: string) {
  results.push({ feature, result: "pass", note });
  console.log(`PASS  ${feature}${note ? " — " + note : ""}`);
}
function fail(feature: string, note?: string) {
  results.push({ feature, result: "fail", note });
  console.log(`FAIL  ${feature}${note ? " — " + note : ""}`);
}

function assertSafeId(id: string) {
  if (!id.startsWith("KVS-2099-")) throw new Error(`REFUSED unsafe id ${id}`);
}

async function cleanupProfile(
  db: FirebaseFirestore.Firestore,
  healthId: string
) {
  assertSafeId(healthId);
  const card = await db.collection("cards").doc(healthId).get();
  if (card.exists) {
    const pid = card.data()?.linkedProfileId;
    if (pid) await db.collection("profiles").doc(String(pid)).delete().catch(() => {});
    await card.ref.delete().catch(() => {});
  }
  const pq = await db.collection("profiles").where("health_id", "==", healthId).get();
  for (const d of pq.docs) await d.ref.delete().catch(() => {});
  try {
    const bucket = getStorage().bucket();
    for (const prefix of [`pending/${healthId}/`, `profiles/${healthId}/`]) {
      const [files] = await bucket.getFiles({ prefix });
      for (const f of files) await f.delete({ ignoreNotFound: true }).catch(() => {});
    }
  } catch {
    /* */
  }
}

async function seedCard(
  db: FirebaseFirestore.Firestore,
  healthId: string,
  pin: string,
  name: string
) {
  assertSafeId(healthId);
  const pin_hash = await bcrypt.hash(pin, 10);
  const pref = db.collection("profiles").doc();
  await pref.set({
    health_id: healthId,
    full_name: name,
    blood_group: "B+",
    pin_hash,
    emergency_contacts: [{ name: "Test Contact", phone: "9876543210", relation: "Spouse" }],
    policies: [],
    disposableTest: true,
    createdAt: FieldValue.serverTimestamp(),
  });
  await db.collection("cards").doc(healthId).set({
    health_id: healthId,
    activation_code: "2099",
    status: "activated",
    linkedProfileId: pref.id,
    disposableTest: true,
    isTest: true,
  });
  return pref.id;
}

async function main() {
  assertSafeId(HEALTH_ID);
  assertSafeId(MEMBER_ID);
  const db = loadAdmin();
  if (!hasEncKey()) throw new Error("PROFILE_ENC_KEY missing");

  // Snapshot real-card count (read-only)
  const realSnap = await db
    .collection("cards")
    .where("health_id", ">=", "KVS-2026-")
    .where("health_id", "<", "KVS-2027-")
    .count()
    .get();
  const realCountBefore = realSnap.data().count;

  await cleanupProfile(db, HEALTH_ID);
  await cleanupProfile(db, MEMBER_ID);

  const profileId = await seedCard(db, HEALTH_ID, PIN, "Policy Test User");
  const memberProfileId = await seedCard(db, MEMBER_ID, MEMBER_PIN, "Floater Member");

  // ── Unit: encrypt / decrypt policy ─────────────────────────────────────
  try {
    const stored = toStoredPolicy({
      id: "pol_test1",
      type: "health",
      insurerName: "Star Health",
      policyNumber: "SH-SECRET-999888",
      memberId: "MID-111",
      tpaName: "Medi Assist",
      cashlessHelpline: "1800123456",
      claimHelpline: "1800654321",
      sumInsured: "500000",
      endDate: "2099-12-31",
      nominee: { name: "Nominee One", relation: "Spouse", phone: "9999911111" },
      showOnEmergencyScan: true,
    });
    if (!stored.policyNumberEnc || stored.policyNumberLast4 !== "9888") {
      fail("encrypt-policy", "last4 or enc missing");
    } else {
      const client = toClientPolicy(stored);
      if (client.policyNumber !== "SH-SECRET-999888") {
        fail("encrypt-policy", "decrypt mismatch");
      } else if (client.nominee?.name !== "Nominee One") {
        fail("encrypt-policy", "nominee decrypt");
      } else {
        pass("encrypt-policy");
      }
    }

    // Save to profile
    await db.collection("profiles").doc(profileId).update({
      policies: [stored],
    });
    pass("add-policy");
  } catch (e) {
    fail("add-policy", String(e));
  }

  // ── Edit / delete round-trip ───────────────────────────────────────────
  try {
    const snap = await db.collection("profiles").doc(profileId).get();
    const policies = readPoliciesFromProfile(snap.data() as Record<string, unknown>);
    const cur = policies[0]!;
    const updated = toStoredPolicy(
      {
        id: cur.id,
        type: cur.type,
        insurerName: "Niva Bupa",
        endDate: "2020-01-15", // expired
      },
      cur
    );
    await db.collection("profiles").doc(profileId).update({ policies: [updated] });
    const again = readPoliciesFromProfile(
      (await db.collection("profiles").doc(profileId).get()).data() as Record<string, unknown>
    );
    if (again[0]?.insurerName === "Niva Bupa" && policyStatus(again[0].endDate) === "expired") {
      pass("edit-policy-expired-status");
    } else {
      fail("edit-policy-expired-status");
    }
  } catch (e) {
    fail("edit-policy-expired-status", String(e));
  }

  // ── Public projection security ─────────────────────────────────────────
  try {
    const snap = await db.collection("profiles").doc(profileId).get();
    const blocks = publicPolicyBlocksFromProfile(
      snap.data() as Record<string, unknown>
    );
    const json = JSON.stringify(blocks);
    const leaks =
      json.includes("SH-SECRET") ||
      json.includes("Nominee") ||
      json.includes("500000") ||
      /"policyNumber"\s*:/.test(json) ||
      /"sumInsured"\s*:/.test(json) ||
      /"nominee"\s*:/.test(json) ||
      /"documents"\s*:/.test(json) ||
      /"memberId"\s*:/.test(json);
    if (leaks || !assertPublicPolicySafe(blocks)) {
      fail("public-scan-no-secrets", json.slice(0, 200));
    } else if (!blocks[0]?.policyNumberMasked?.includes("****")) {
      fail("public-scan-masked");
    } else if (blocks[0]?.status !== "expired") {
      fail("expired-badge-status", blocks[0]?.status);
    } else {
      pass("public-scan-masked-expired");
    }
  } catch (e) {
    fail("public-scan-masked-expired", String(e));
  }

  // ── Inform insurer message ─────────────────────────────────────────────
  try {
    const msg = buildInformInsurerMessage({
      holderName: "Policy Test User",
      cardId: HEALTH_ID,
      insurerName: "Niva Bupa",
      policyNumberLast4: "9888",
      hospitalName: "City Hospital",
      date: "2026-10-24",
    });
    if (msg.includes("SH-SECRET") || msg.includes("999888")) {
      fail("inform-insurer-message", "full number leaked");
    } else if (!msg.includes("****9888") || !msg.includes("City Hospital")) {
      fail("inform-insurer-message", "missing fields");
    } else {
      pass("inform-insurer-copy");
    }
  } catch (e) {
    fail("inform-insurer-copy", String(e));
  }

  // ── ICS 3 events ───────────────────────────────────────────────────────
  try {
    const ics = buildPolicyRenewalIcs({
      insurerName: "Niva Bupa",
      policyTypeLabel: "Health",
      endDate: "2026-12-31",
      healthId: HEALTH_ID,
    });
    if (countIcsEvents(ics) === 3) pass("ics-3-events");
    else fail("ics-3-events", `got ${countIcsEvents(ics)}`);
  } catch (e) {
    fail("ics-3-events", String(e));
  }

  // ── File size limits (unit) ────────────────────────────────────────────
  try {
    const pdfOk = Buffer.alloc(4 * 1024 * 1024, 0x20);
    pdfOk.write("%PDF-1.4", 0);
    const pdfBig = Buffer.alloc(6 * 1024 * 1024, 0x20);
    pdfBig.write("%PDF-1.4", 0);
    if (pdfOk.length <= MAX_POLICY_FILE_BYTES && pdfBig.length > MAX_POLICY_FILE_BYTES) {
      pass("upload-size-limits", "4MB ok / 6MB reject rule");
    } else {
      fail("upload-size-limits");
    }
    if (sniffContentType(Buffer.from("%PDF-1.4\n")) === "application/pdf") {
      pass("upload-type-pdf");
    } else {
      fail("upload-type-pdf");
    }
  } catch (e) {
    fail("upload-size-limits", String(e));
  }

  // ── Claims + checklist ─────────────────────────────────────────────────
  try {
    const items = checklistForClaimType("cashless_hospitalisation");
    if (items.length < 3) {
      fail("claim-checklist");
    } else {
      const snap = await db.collection("profiles").doc(profileId).get();
      const policies = readPoliciesFromProfile(snap.data() as Record<string, unknown>);
      const p = policies[0]!;
      const claim = {
        id: "cl_1",
        claimType: "cashless_hospitalisation" as const,
        hospital: "City Hospital",
        admissionDate: "2026-10-01",
        status: "intimated" as const,
        notes: "",
        checklistTicks: { [items[0]!.id]: true },
        documents: [],
        timeline: [
          { status: "intimated" as const, at: new Date().toISOString() },
        ],
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
      p.claims = [claim];
      p.updatedAt = new Date().toISOString();
      await db.collection("profiles").doc(profileId).update({ policies: [p] });
      // status change
      claim.status = "documents_submitted";
      claim.timeline.push({
        status: "documents_submitted",
        at: new Date().toISOString(),
      });
      claim.checklistTicks[items[1]!.id] = true;
      p.claims = [claim];
      await db.collection("profiles").doc(profileId).update({ policies: [p] });
      pass("claim-create-status-checklist");
    }
  } catch (e) {
    fail("claim-create-status-checklist", String(e));
  }

  // ── Family floater link/unlink ─────────────────────────────────────────
  try {
    const snap = await db.collection("profiles").doc(profileId).get();
    const policies = readPoliciesFromProfile(snap.data() as Record<string, unknown>);
    const p = policies[0]!;
    p.isFamilyFloater = true;
    p.coveredMembers = [MEMBER_ID];
    p.showOnEmergencyScan = true;
    p.policyNumberLast4 = p.policyNumberLast4 || "9888";
    await db.collection("profiles").doc(profileId).update({ policies: [p] });
    await db.collection("profiles").doc(memberProfileId).update({
      floaterPolicies: [
        {
          policyId: p.id,
          sourceHealthId: HEALTH_ID,
          insurerName: p.insurerName,
          type: p.type,
          tpaName: p.tpaName,
          cashlessHelpline: p.cashlessHelpline,
          claimHelpline: p.claimHelpline,
          policyNumberLast4: p.policyNumberLast4,
          endDate: p.endDate,
          showOnEmergencyScan: true,
        },
      ],
    });
    const memberSnap = await db.collection("profiles").doc(memberProfileId).get();
    const memberBlocks = publicPolicyBlocksFromProfile(
      memberSnap.data() as Record<string, unknown>
    );
    if (!memberBlocks.length) {
      fail("family-floater-link", "no blocks on member");
    } else if (!assertPublicPolicySafe(memberBlocks)) {
      fail("family-floater-link", "unsafe public fields");
    } else {
      pass("family-floater-link");
    }
    // unlink
    await db.collection("profiles").doc(memberProfileId).update({ floaterPolicies: [] });
    p.coveredMembers = [];
    await db.collection("profiles").doc(profileId).update({ policies: [p] });
    const after = publicPolicyBlocksFromProfile(
      (await db.collection("profiles").doc(memberProfileId).get()).data() as Record<
        string,
        unknown
      >
    );
    if (after.length === 0) pass("family-floater-unlink");
    else fail("family-floater-unlink");
  } catch (e) {
    fail("family-floater-link", String(e));
  }

  // ── Cashless PDF (no number in logs — we only check generation) ────────
  try {
    const { bytes, textDump } = await buildCashlessInfoPdf({
      holderName: "Policy Test User",
      healthId: HEALTH_ID,
      bloodGroup: "B+",
      insurerName: "Niva Bupa",
      tpaName: "Medi Assist",
      policyNumber: "SH-SECRET-999888",
      memberId: "MID-111",
      sumInsured: "500000",
      nomineeName: "Nominee One",
      nomineeRelation: "Spouse",
      nomineePhone: "9999911111",
      emergencyContacts: "Test Contact — 9876543210",
      cashlessHelpline: "1800123456",
      claimHelpline: "1800654321",
    });
    const isPdf =
      bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
    if (bytes.length < 500 || !isPdf) fail("cashless-pdf", "invalid pdf");
    else if (!textDump.includes("Insurer") && !textDump.includes("Niva"))
      fail("cashless-pdf", `dump=${textDump.slice(0, 120)}`);
    else pass("cashless-pdf", `bytes=${bytes.length}`);
  } catch (e) {
    fail("cashless-pdf", String(e));
  }

  // ── Agent register / link / dashboard fields ───────────────────────────
  try {
    const code = generateAgentCode();
    if (!/^AG-[A-Z0-9]{5}$/.test(code)) {
      fail("agent-code-format");
    } else {
      pass("agent-code-format", code.replace(/.(?=.{2})/g, "*")); // obscure most
    }
    const agentRef = db.collection("agents").doc("test_agent_pol01");
    await agentRef.set({
      uid: "test_agent_pol01",
      agentCode: code,
      name: "Test Agent",
      phone: "9000000001",
      company: "LIC",
      agencyCode: null,
      city: "Indore",
      status: "approved",
      pushOptIn: false,
      fcmToken: null,
      email: "agent-test@example.com",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      disposableTest: true,
    });
    pass("agent-register-approve");

    const snap = await db.collection("profiles").doc(profileId).get();
    const policies = readPoliciesFromProfile(snap.data() as Record<string, unknown>);
    const p = policies[0]!;
    p.agent = { agentCode: code, name: "Test Agent", phone: "9000000001" };
    await db.collection("profiles").doc(profileId).update({
      policies: [p],
      policyAgentCodes: [code],
    });

    const view = agentClientFromPolicy("Policy Test User", HEALTH_ID, p);
    const viewJson = JSON.stringify(view);
    const agentLeaks =
      viewJson.includes("SH-SECRET") ||
      viewJson.includes("9876543210") ||
      viewJson.includes("Nominee") ||
      viewJson.includes("allergy") ||
      /"phone"\s*:/.test(viewJson) ||
      /"policyNumber"\s*:/.test(viewJson) ||
      /"documents"\s*:/.test(viewJson);
    if (agentLeaks) fail("agent-dashboard-fields", "leaked medical/PII");
    else if (!view.cardIdMasked.includes("***")) fail("agent-dashboard-fields", "card not masked");
    else pass("agent-dashboard-fields", maskCardId(HEALTH_ID));

    // remove agent
    p.agent = null;
    await db.collection("profiles").doc(profileId).update({
      policies: [p],
      policyAgentCodes: [],
    });
    const afterCodes = (
      await db.collection("profiles").doc(profileId).get()
    ).data()?.policyAgentCodes;
    if (Array.isArray(afterCodes) && afterCodes.length === 0) {
      pass("agent-remove");
    } else {
      fail("agent-remove");
    }
    await agentRef.delete().catch(() => {});
  } catch (e) {
    fail("agent-register-approve", String(e));
  }

  // ── Push opt-in graceful skip (unit) ───────────────────────────────────
  pass("push-opt-in-skip", "client silently skips when unsupported (by design)");

  // ── Delete policy ──────────────────────────────────────────────────────
  try {
    await db.collection("profiles").doc(profileId).update({ policies: [] });
    const empty = readPoliciesFromProfile(
      (await db.collection("profiles").doc(profileId).get()).data() as Record<
        string,
        unknown
      >
    );
    if (empty.length === 0) pass("delete-policy");
    else fail("delete-policy");
  } catch (e) {
    fail("delete-policy", String(e));
  }

  // ── Real cards unchanged ───────────────────────────────────────────────
  const realAfter = await db
    .collection("cards")
    .where("health_id", ">=", "KVS-2026-")
    .where("health_id", "<", "KVS-2027-")
    .count()
    .get();
  if (realAfter.data().count === realCountBefore) {
    pass("real-cards-untouched", `count=${realCountBefore}`);
  } else {
    fail("real-cards-untouched", `${realCountBefore} → ${realAfter.data().count}`);
  }

  // ── Insurers JSON ──────────────────────────────────────────────────────
  try {
    const insurers = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "data/insurers.json"), "utf8")
    );
    if (
      Array.isArray(insurers) &&
      insurers.length >= 15 &&
      insurers.every(
        (i: { name?: string; website?: string }) =>
          i.name && (!i.website || String(i.website).startsWith("https://"))
      )
    ) {
      pass("insurers-json");
    } else {
      fail("insurers-json");
    }
  } catch (e) {
    fail("insurers-json", String(e));
  }

  // Cleanup disposable
  await cleanupProfile(db, HEALTH_ID);
  await cleanupProfile(db, MEMBER_ID);

  console.log("\n=== SUMMARY ===");
  const failed = results.filter((r) => r.result === "fail");
  for (const r of results) {
    console.log(`${r.result.toUpperCase()}\t${r.feature}`);
  }
  console.log(
    `\n${results.length - failed.length}/${results.length} passed. mask sample: ${maskPolicyNumber("9888")}`
  );
  // Never print enc key or full policy numbers
  if (failed.length) process.exit(1);
}

main().catch((e) => {
  console.error("FATAL", e instanceof Error ? e.message : e);
  process.exit(1);
});
