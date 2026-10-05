/**
 * Unit tests for activation schedule gate (mock clock via ACTIVATION_TEST_NOW).
 * Uses disposable KVS-2099-* forced-as-real — never A0001–A0100 / printed inventory.
 *
 * Run:
 *   ./node_modules/.bin/ts-node --skipProject --compiler-options '{"module":"commonjs","esModuleInterop":true}' scripts/test-activation-schedule.ts
 */
import assert from "assert";

const REAL = "KVS-2099-TREAL"; // forced real via ACTIVATION_TEST_AS_REAL
const DEMO = "KVS-DEMO-00001";
const EXEMPT_2099 = "KVS-2099-AAAAA";
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
  // bust module cache so env is re-read... gate reads env at call time, OK
}

async function loadGate() {
  // CommonJS re-require after env change (ts-node)
  const path = require.resolve("../src/lib/activationGate");
  delete require.cache[path];
  return require("../src/lib/activationGate") as typeof import("../src/lib/activationGate");
}

async function main() {
  // 1) Before opens → ACTIVATION_NOT_OPEN for forced-real 2099
  resetEnv({
    ACTIVATION_OPENS_AT: OPENS,
    ACTIVATION_TEST_NOW: BEFORE,
    ACTIVATION_TEST_AS_REAL: REAL,
  });
  let gate = await loadGate();
  let r = gate.evaluateActivationGate(REAL, false);
  if (!r.ok && r.code === "ACTIVATION_NOT_OPEN") {
    pass("1 before→NOT_OPEN", r.code);
  } else fail("1 before→NOT_OPEN", JSON.stringify(r));

  // 2) After opens → ok
  resetEnv({
    ACTIVATION_OPENS_AT: OPENS,
    ACTIVATION_TEST_NOW: AFTER,
    ACTIVATION_TEST_AS_REAL: REAL,
  });
  gate = await loadGate();
  r = gate.evaluateActivationGate(REAL, false);
  if (r.ok) pass("2 after→ok", "ok");
  else fail("2 after→ok", JSON.stringify(r));

  // 3) Kill switch after open → ACTIVATION_DISABLED
  resetEnv({
    ACTIVATION_OPENS_AT: OPENS,
    ACTIVATION_TEST_NOW: AFTER,
    ACTIVATION_TEST_AS_REAL: REAL,
    ACTIVATION_ENABLED: "false",
  });
  gate = await loadGate();
  r = gate.evaluateActivationGate(REAL, false);
  if (!r.ok && r.code === "ACTIVATION_DISABLED") {
    pass("3 kill→DISABLED", r.code);
  } else fail("3 kill→DISABLED", JSON.stringify(r));

  // 4) Demo before + after + kill → always ok
  resetEnv({
    ACTIVATION_OPENS_AT: OPENS,
    ACTIVATION_TEST_NOW: BEFORE,
    ACTIVATION_ENABLED: "false",
  });
  gate = await loadGate();
  if (gate.canActivateHealthId(DEMO, true)) pass("4a demo before+kill", "ok");
  else fail("4a demo before+kill", "blocked");

  resetEnv({
    ACTIVATION_OPENS_AT: OPENS,
    ACTIVATION_TEST_NOW: AFTER,
  });
  gate = await loadGate();
  if (gate.canActivateHealthId(DEMO, false)) pass("4b demo after", "ok");
  else fail("4b demo after", "blocked");

  // 5) Normal 2099 exempt even when forced-real list empty + before open
  resetEnv({
    ACTIVATION_OPENS_AT: OPENS,
    ACTIVATION_TEST_NOW: BEFORE,
  });
  gate = await loadGate();
  if (gate.canActivateHealthId(EXEMPT_2099, false)) {
    pass("5 2099 exempt before", "ok");
  } else fail("5 2099 exempt before", "blocked");

  // 6) ACTIVATION_TEST_NOW ignored in production
  resetEnv({
    ACTIVATION_OPENS_AT: OPENS,
    ACTIVATION_TEST_NOW: BEFORE,
    ACTIVATION_TEST_AS_REAL: REAL,
    NODE_ENV: "production",
  });
  gate = await loadGate();
  // In production with real "now" (Oct 2026 before Nov... today is Oct 2 2026 in user_info earlier - wait user_info said Oct 2 2026). So BEFORE mock ignored → real now is before Oct 11 → NOT_OPEN
  r = gate.evaluateActivationGate(REAL, false);
  // Forced real also ignored in prod → REAL is 2099 → exempt → ok!
  // So we need a non-2099 id for this check
  const REAL_PROD = "KVS-2026-T9999";
  resetEnv({
    ACTIVATION_OPENS_AT: OPENS,
    ACTIVATION_TEST_NOW: AFTER, // would open if honored
    NODE_ENV: "production",
  });
  gate = await loadGate();
  const now = gate.getActivationNow().getTime();
  const opens = Date.parse(OPENS);
  r = gate.evaluateActivationGate(REAL_PROD, false);
  if (now < opens) {
    if (!r.ok && r.code === "ACTIVATION_NOT_OPEN") {
      pass("6 TEST_NOW ignored in prod", `now<opens code=${r.code}`);
    } else fail("6 TEST_NOW ignored in prod", JSON.stringify(r));
  } else {
    // clock already past opens in this environment
    if (r.ok) pass("6 TEST_NOW ignored in prod", "already past opens");
    else fail("6 TEST_NOW ignored in prod", JSON.stringify(r));
  }

  // 7) isDemo flag bypasses even for non-exempt id
  resetEnv({
    ACTIVATION_OPENS_AT: OPENS,
    ACTIVATION_TEST_NOW: BEFORE,
    ACTIVATION_ENABLED: "false",
  });
  gate = await loadGate();
  if (gate.canActivateHealthId("KVS-2026-T9999", true)) {
    pass("7 isDemo flag", "ok");
  } else fail("7 isDemo flag", "blocked");

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
