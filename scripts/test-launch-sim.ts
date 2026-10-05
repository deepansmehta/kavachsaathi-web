/**
 * Launch simulation unit tests — must be ignored in production CONTEXT.
 *
 *   npx ts-node --skipProject --compiler-options '{"module":"commonjs","esModuleInterop":true}' \
 *     scripts/test-launch-sim.ts
 */
const DEMO = "KVS-DEMO-00001";

type Case = { id: string; result: "PASS" | "FAIL"; detail: string };
const rows: Case[] = [];

function pass(id: string, detail = "") {
  rows.push({ id, result: "PASS", detail });
  console.log(`  PASS  ${id}${detail ? " — " + detail : ""}`);
}
function fail(id: string, detail: string) {
  rows.push({ id, result: "FAIL", detail });
  console.log(`  FAIL  ${id} — ${detail}`);
}

function resetEnv(partial: Record<string, string | undefined>) {
  for (const k of [
    "LAUNCH_SIM_ENABLED",
    "CONTEXT",
    "NETLIFY_CONTEXT",
    "NODE_ENV",
    "ACTIVATION_OPENS_AT",
    "ACTIVATION_ENABLED",
    "ACTIVATION_TEST_NOW",
  ]) {
    delete process.env[k];
  }
  process.env.NODE_ENV = "test";
  for (const [k, v] of Object.entries(partial)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

function loadSim() {
  const p = require.resolve("../src/lib/launchSim");
  delete require.cache[p];
  return require("../src/lib/launchSim") as typeof import("../src/lib/launchSim");
}
function loadGate() {
  const p = require.resolve("../src/lib/activationGate");
  delete require.cache[p];
  const launch = require.resolve("../src/lib/launchConfig");
  delete require.cache[launch];
  const sim = require.resolve("../src/lib/launchSim");
  delete require.cache[sim];
  return require("../src/lib/activationGate") as typeof import("../src/lib/activationGate");
}
function loadLaunch() {
  const p = require.resolve("../src/lib/launchConfig");
  delete require.cache[p];
  const sim = require.resolve("../src/lib/launchSim");
  delete require.cache[sim];
  return require("../src/lib/launchConfig") as typeof import("../src/lib/launchConfig");
}

async function main() {
  console.log("=== Launch simulation (preview-only) ===\n");

  // 1) Production CONTEXT ignores flag + cookie
  resetEnv({
    CONTEXT: "production",
    LAUNCH_SIM_ENABLED: "true",
  });
  let sim = loadSim();
  if (!sim.isLaunchSimEnabled()) pass("1a production → sim disabled");
  else fail("1a production → sim disabled", "enabled=true");
  if (sim.parseLaunchSimCookie(String(Date.now() + 30_000)) === null)
    pass("1b production ignores cookie parse");
  else fail("1b production ignores cookie parse", "parsed non-null");

  let gate = loadGate();
  const future = Date.now() + 60_000;
  let r = gate.evaluateActivationGate(DEMO, true, new Date(), {
    simOpensAtMs: future,
  });
  if (r.ok) pass("1c production demo still exempt despite simOpensAtMs");
  else fail("1c production demo still exempt", JSON.stringify(r));

  // 2) Preview + flag: sim active, demo gated until sim time
  resetEnv({
    CONTEXT: "deploy-preview",
    LAUNCH_SIM_ENABLED: "true",
    ACTIVATION_OPENS_AT: "2026-10-11T12:00:00+05:30",
  });
  sim = loadSim();
  gate = loadGate();
  const launchCfg = loadLaunch();
  if (sim.isLaunchSimEnabled()) pass("2a deploy-preview + flag → enabled");
  else fail("2a deploy-preview + flag → enabled", "false");

  const opens = Date.now() + 30_000;
  r = gate.evaluateActivationGate(DEMO, true, new Date(), {
    simOpensAtMs: opens,
  });
  if (!r.ok && r.code === "ACTIVATION_NOT_OPEN")
    pass("2b demo NOT_OPEN under sim before");
  else fail("2b demo NOT_OPEN under sim before", JSON.stringify(r));

  r = gate.evaluateActivationGate(DEMO, true, new Date(opens + 1000), {
    simOpensAtMs: opens,
  });
  if (r.ok) pass("2c demo ok after sim opens");
  else fail("2c demo ok after sim opens", JSON.stringify(r));

  if (!launchCfg.isSiteLaunched(new Date(), opens))
    pass("2d middleware site gated before sim");
  else fail("2d middleware site gated before sim", "launched");
  if (launchCfg.isSiteLaunched(new Date(opens + 1), opens))
    pass("2e middleware site open after sim");
  else fail("2e middleware site open after sim", "still gated");

  // 3) Flag off on preview → no sim
  resetEnv({
    CONTEXT: "deploy-preview",
    LAUNCH_SIM_ENABLED: "false",
  });
  sim = loadSim();
  gate = loadGate();
  if (!sim.isLaunchSimEnabled()) pass("3a flag false → disabled");
  else fail("3a flag false → disabled", "enabled");
  r = gate.evaluateActivationGate(DEMO, true, new Date(), {
    simOpensAtMs: Date.now() + 60_000,
  });
  if (r.ok) pass("3b demo exempt when flag off");
  else fail("3b demo exempt when flag off", JSON.stringify(r));

  // 4) launchIn bounds
  resetEnv({ CONTEXT: "branch-deploy", LAUNCH_SIM_ENABLED: "true" });
  sim = loadSim();
  if (sim.parseLaunchInParam("30") === 30) pass("4a launchIn=30 ok");
  else fail("4a launchIn=30 ok", String(sim.parseLaunchInParam("30")));
  if (sim.parseLaunchInParam("5") === null) pass("4b launchIn=5 rejected");
  else fail("4b launchIn=5 rejected", "accepted");
  if (sim.parseLaunchInParam("301") === null) pass("4c launchIn=301 rejected");
  else fail("4c launchIn=301 rejected", "accepted");
  if (sim.parseLaunchInParam("reset") === "reset") pass("4d launchIn=reset");
  else fail("4d launchIn=reset", String(sim.parseLaunchInParam("reset")));

  // 5) Without cookie / opts — demo unchanged
  resetEnv({
    CONTEXT: "deploy-preview",
    LAUNCH_SIM_ENABLED: "true",
    ACTIVATION_OPENS_AT: "2099-01-01T00:00:00Z",
  });
  gate = loadGate();
  r = gate.evaluateActivationGate(DEMO, true);
  if (r.ok) pass("5 demo open without sim cookie (today behavior)");
  else fail("5 demo open without sim cookie", JSON.stringify(r));

  const fails = rows.filter((x) => x.result === "FAIL");
  console.log(
    `\n=== summary ===\n${rows.length - fails.length}/${rows.length} PASS`
  );
  if (fails.length) {
    console.log("FAILED:");
    for (const f of fails) console.log(`  ${f.id}: ${f.detail}`);
    process.exit(1);
  }
  console.log("ALL PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
