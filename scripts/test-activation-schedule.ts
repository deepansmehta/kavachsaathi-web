/**
 * Activation schedule gate tests.
 * Real kits (KVS-2026-*) always use wall clock — ACTIVATION_TEST_NOW never opens them.
 * Demo + KVS-2099-* remain exempt.
 *
 *   npx tsx scripts/test-activation-schedule.ts
 */
import assert from "assert";

const DEMO = "KVS-DEMO-00001";
const EXEMPT_2099 = "KVS-2099-AAAAA";
const REAL_2026 = "KVS-2026-T9999";
const OPENS = "2026-10-11T12:00:00+05:30";
const BEFORE = "2026-10-11T11:59:00+05:30";
const AFTER = "2026-10-11T12:00:01+05:30";

type Case = { id: string; result: "PASS" | "FAIL"; detail: string };
const rows: Case[] = [];

function pass(id: string, detail: string) {
  rows.push({ id, result: "PASS", detail });
}
function fail(id: string, detail: string) {
  rows.push({ id, result: "FAIL", detail });
}

function resetEnv(partial: Record<string, string | undefined>) {
  const keys = [
    "ACTIVATION_ENABLED",
    "ACTIVATION_OPENS_AT",
    "ACTIVATION_TEST_NOW",
    "ACTIVATION_TEST_AS_REAL",
    "NODE_ENV",
    "CONTEXT",
    "NETLIFY_CONTEXT",
  ];
  for (const k of keys) delete process.env[k];
  process.env.NODE_ENV = "test";
  for (const [k, v] of Object.entries(partial)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

async function loadGate() {
  const path = require.resolve("../src/lib/activationGate");
  delete require.cache[path];
  const launchPath = require.resolve("../src/lib/launchConfig");
  delete require.cache[launchPath];
  return require("../src/lib/activationGate") as typeof import("../src/lib/activationGate");
}

async function main() {
  const opensMs = Date.parse(OPENS);
  const wallNow = Date.now();
  assert.ok(!Number.isNaN(opensMs));

  // 1) Real 2026 before opens (wall) → NOT_OPEN
  resetEnv({ ACTIVATION_OPENS_AT: OPENS });
  let gate = await loadGate();
  let r = gate.evaluateActivationGate(REAL_2026, false);
  if (wallNow < opensMs) {
    if (!r.ok && r.code === "ACTIVATION_NOT_OPEN")
      pass("1 real before→NOT_OPEN", r.code);
    else fail("1 real before→NOT_OPEN", JSON.stringify(r));
  } else {
    if (r.ok) pass("1 real before→NOT_OPEN", "wall already past opens");
    else fail("1 real before→NOT_OPEN", JSON.stringify(r));
  }

  // 2) CRITICAL: ACTIVATION_TEST_NOW=AFTER must NOT open real 2026 when wall < opens
  resetEnv({
    ACTIVATION_OPENS_AT: OPENS,
    ACTIVATION_TEST_NOW: AFTER,
    NODE_ENV: "development",
  });
  gate = await loadGate();
  r = gate.evaluateActivationGate(REAL_2026, false);
  if (wallNow < opensMs) {
    if (!r.ok && r.code === "ACTIVATION_NOT_OPEN") {
      pass("2 TEST_NOW ignored for real", r.code);
    } else fail("2 TEST_NOW ignored for real", JSON.stringify(r));
  } else {
    pass("2 TEST_NOW ignored for real", "wall past opens — skip");
  }

  // 3) Kill switch
  resetEnv({
    ACTIVATION_OPENS_AT: OPENS,
    ACTIVATION_ENABLED: "false",
    ACTIVATION_TEST_NOW: AFTER,
  });
  gate = await loadGate();
  r = gate.evaluateActivationGate(REAL_2026, false);
  if (!r.ok && r.code === "ACTIVATION_DISABLED") pass("3 kill→DISABLED", r.code);
  else fail("3 kill→DISABLED", JSON.stringify(r));

  // 4) Demo exempt even before + kill
  resetEnv({
    ACTIVATION_OPENS_AT: OPENS,
    ACTIVATION_TEST_NOW: BEFORE,
    ACTIVATION_ENABLED: "false",
  });
  gate = await loadGate();
  if (gate.canActivateHealthId(DEMO, true)) pass("4a demo before+kill", "ok");
  else fail("4a demo before+kill", "blocked");
  if (gate.canActivateHealthId(DEMO, false)) pass("4b demo id exempt", "ok");
  else fail("4b demo id exempt", "blocked");

  // 5) 2099 exempt before open
  resetEnv({
    ACTIVATION_OPENS_AT: OPENS,
    ACTIVATION_TEST_NOW: BEFORE,
  });
  gate = await loadGate();
  if (gate.canActivateHealthId(EXEMPT_2099, false))
    pass("5 2099 exempt before", "ok");
  else fail("5 2099 exempt before", "blocked");

  // 6) Production + TEST_NOW=AFTER still blocks real before opens
  resetEnv({
    ACTIVATION_OPENS_AT: OPENS,
    ACTIVATION_TEST_NOW: AFTER,
    NODE_ENV: "production",
  });
  gate = await loadGate();
  r = gate.evaluateActivationGate(REAL_2026, false);
  if (wallNow < opensMs) {
    if (!r.ok && r.code === "ACTIVATION_NOT_OPEN")
      pass("6 prod ignores TEST_NOW", r.code);
    else fail("6 prod ignores TEST_NOW", JSON.stringify(r));
  } else {
    pass("6 prod ignores TEST_NOW", "wall past opens");
  }

  // 7) isDemo flag on 2026 id
  resetEnv({
    ACTIVATION_OPENS_AT: OPENS,
    ACTIVATION_TEST_NOW: BEFORE,
    ACTIVATION_ENABLED: "false",
  });
  gate = await loadGate();
  if (gate.canActivateHealthId(REAL_2026, true)) pass("7 isDemo flag", "ok");
  else fail("7 isDemo flag", "blocked");

  // 8) getActivationNow is wall clock (not TEST_NOW)
  resetEnv({
    ACTIVATION_OPENS_AT: OPENS,
    ACTIVATION_TEST_NOW: AFTER,
    NODE_ENV: "development",
  });
  gate = await loadGate();
  const mockAfter = Date.parse(AFTER);
  const actNow = gate.getActivationNow().getTime();
  if (Math.abs(actNow - Date.now()) < 5000 && actNow !== mockAfter) {
    pass("8 getActivationNow=wall", `delta=${Math.abs(actNow - Date.now())}ms`);
  } else if (wallNow >= opensMs) {
    pass("8 getActivationNow=wall", "ok");
  } else {
    fail("8 getActivationNow=wall", `actNow=${actNow} mockAfter=${mockAfter}`);
  }

  console.log("=== ACTIVATION SCHEDULE TESTS ===");
  for (const row of rows) {
    console.log(`${row.result}\t${row.id}\t${row.detail}`);
  }
  const failed = rows.filter((x) => x.result === "FAIL").length;
  console.log(`summary: ${rows.length - failed}/${rows.length} PASS`);
  if (failed) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
