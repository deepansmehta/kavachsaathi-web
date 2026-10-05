/**
 * Pre-launch site gate ↔ ACTIVATION_OPENS_AT alignment (mock clock).
 *
 * Non-production only — sets ACTIVATION_TEST_NOW.
 *
 *   npx ts-node --skipProject --compiler-options '{"module":"commonjs","esModuleInterop":true}' \
 *     scripts/test-prelaunch-gate.ts
 */
import assert from "assert";

const OPENS = "2026-10-11T12:00:00+05:30";
const BEFORE = "2026-10-11T11:59:00+05:30";
const AFTER = "2026-10-11T12:00:01+05:30";
const REAL = "KVS-2099-TREAL";

type Row = { id: string; ok: boolean; detail: string };
const rows: Row[] = [];

function pass(id: string, detail = "") {
  rows.push({ id, ok: true, detail });
  console.log(`  PASS  ${id}${detail ? " — " + detail : ""}`);
}
function fail(id: string, detail: string) {
  rows.push({ id, ok: false, detail });
  console.error(`  FAIL  ${id} — ${detail}`);
}

function resetEnv(partial: Record<string, string | undefined>) {
  for (const k of [
    "ACTIVATION_ENABLED",
    "ACTIVATION_OPENS_AT",
    "ACTIVATION_TEST_NOW",
    "ACTIVATION_TEST_AS_REAL",
    "SITE_PRELAUNCH_FORCE",
    "LAUNCH_FORCE",
    "NEXT_PUBLIC_LAUNCH_DATE",
    "NODE_ENV",
    "CONTEXT",
    "NETLIFY_CONTEXT",
  ]) {
    delete process.env[k];
  }
  process.env.NODE_ENV = "test";
  for (const [k, v] of Object.entries(partial)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

function loadLaunch() {
  const p = require.resolve("../src/lib/launchConfig");
  delete require.cache[p];
  return require("../src/lib/launchConfig") as typeof import("../src/lib/launchConfig");
}

function loadGate() {
  // launchConfig must reload first (gate imports it)
  const lp = require.resolve("../src/lib/launchConfig");
  delete require.cache[lp];
  const gp = require.resolve("../src/lib/activationGate");
  delete require.cache[gp];
  return require("../src/lib/activationGate") as typeof import("../src/lib/activationGate");
}

/** Paths the middleware treats as pre-launch API allowlist (mirrors middleware.ts). */
function isPreLaunchApiAllowed(pathname: string): boolean {
  return (
    pathname.startsWith("/api/card/") ||
    pathname.startsWith("/api/uploads/") ||
    pathname === "/api/full-details" ||
    pathname.startsWith("/api/forms/") ||
    pathname === "/api/features" ||
    pathname === "/api/alert-family" ||
    pathname === "/api/scan" ||
    pathname === "/api/log-scan" ||
    pathname === "/api/emergency" ||
    pathname === "/api/cashless-timer" ||
    pathname === "/api/vault" ||
    pathname.startsWith("/api/vault/") ||
    pathname === "/api/family" ||
    pathname.startsWith("/api/family/") ||
    pathname === "/api/hospital" ||
    pathname.startsWith("/api/hospital/") ||
    pathname === "/api/org" ||
    pathname.startsWith("/api/org/") ||
    pathname === "/api/donor-directive" ||
    pathname.startsWith("/api/donor-directive/") ||
    pathname === "/api/admin" ||
    pathname.startsWith("/api/admin/")
  );
}

function simulatePreLaunchAccess(
  pathname: string,
  launched: boolean
): "allow" | "redirect_coming_soon" | "503" {
  if (launched) return "allow";
  if (pathname === "/coming-soon" || pathname.startsWith("/coming-soon/"))
    return "allow";
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin"))
    return "allow";
  if (
    pathname.startsWith("/card/") ||
    pathname.startsWith("/e/") ||
    pathname.startsWith("/emergency/")
  )
    return "allow";
  if (isPreLaunchApiAllowed(pathname)) return "allow";
  if (pathname.startsWith("/api/")) return "503";
  return "redirect_coming_soon";
}

async function main() {
  console.log("=== Pre-launch gate ↔ ACTIVATION_OPENS_AT ===\n");

  // 1) BEFORE noon — site closed, real activation NOT_OPEN, admin allowed
  {
    resetEnv({
      ACTIVATION_OPENS_AT: OPENS,
      ACTIVATION_TEST_NOW: BEFORE,
      ACTIVATION_TEST_AS_REAL: REAL,
    });
    const launch = loadLaunch();
    const gate = loadGate();
    assert.strictEqual(launch.isSiteLaunched(), false);
    pass("1a before → isSiteLaunched=false");

    const g = gate.evaluateActivationGate(REAL, false);
    g.ok === false && g.code === "ACTIVATION_NOT_OPEN"
      ? pass("1b before → ACTIVATION_NOT_OPEN")
      : fail("1b before activation", JSON.stringify(g));

    simulatePreLaunchAccess("/my-profile", launch.isSiteLaunched()) ===
    "redirect_coming_soon"
      ? pass("1c before → /my-profile gated")
      : fail("1c /my-profile", "expected redirect");

    simulatePreLaunchAccess("/api/profile/login", launch.isSiteLaunched()) ===
    "503"
      ? pass("1d before → /api/profile/* gated 503")
      : fail("1d profile api", "expected 503");

    simulatePreLaunchAccess("/admin", launch.isSiteLaunched()) === "allow"
      ? pass("1e before → /admin allowed")
      : fail("1e /admin", "expected allow");

    simulatePreLaunchAccess("/api/admin", launch.isSiteLaunched()) === "allow"
      ? pass("1f before → /api/admin allowed")
      : fail("1f /api/admin", "expected allow");

    simulatePreLaunchAccess("/hospital", launch.isSiteLaunched()) ===
    "redirect_coming_soon"
      ? pass("1g before → /hospital gated")
      : fail("1g /hospital", "expected redirect");
  }

  // 2) AFTER noon — site open, activation open, profile allowed
  {
    resetEnv({
      ACTIVATION_OPENS_AT: OPENS,
      ACTIVATION_TEST_NOW: AFTER,
      ACTIVATION_TEST_AS_REAL: REAL,
    });
    const launch = loadLaunch();
    const gate = loadGate();
    launch.isSiteLaunched()
      ? pass("2a after → isSiteLaunched=true")
      : fail("2a after launch", "expected true");

    const g = gate.evaluateActivationGate(REAL, false);
    g.ok
      ? pass("2b after → real activation open")
      : fail("2b after activation", JSON.stringify(g));

    simulatePreLaunchAccess("/my-profile", launch.isSiteLaunched()) === "allow"
      ? pass("2c after → /my-profile allow")
      : fail("2c /my-profile", "expected allow");

    simulatePreLaunchAccess("/api/profile/login", launch.isSiteLaunched()) ===
    "allow"
      ? pass("2d after → /api/profile/* allow")
      : fail("2d profile api", "expected allow");
  }

  // 3) Same instant for both gates
  {
    resetEnv({
      ACTIVATION_OPENS_AT: OPENS,
      ACTIVATION_TEST_NOW: BEFORE,
    });
    const launch = loadLaunch();
    const gate = loadGate();
    const siteMs = launch.getSiteLaunchAtMs();
    const actMs = gate.getActivationOpensAt()!.getTime();
    siteMs === actMs
      ? pass("3 same ACTIVATION_OPENS_AT for site+activation", String(siteMs))
      : fail("3 drift", `site=${siteMs} act=${actMs}`);
  }

  // 4) Emergency force open while clock is before
  {
    resetEnv({
      ACTIVATION_OPENS_AT: OPENS,
      ACTIVATION_TEST_NOW: BEFORE,
      SITE_PRELAUNCH_FORCE: "open",
    });
    const launch = loadLaunch();
    launch.isSiteLaunched()
      ? pass("4a SITE_PRELAUNCH_FORCE=open")
      : fail("4a force open", "expected launched");
  }

  // 5) Emergency force closed while clock is after
  {
    resetEnv({
      ACTIVATION_OPENS_AT: OPENS,
      ACTIVATION_TEST_NOW: AFTER,
      SITE_PRELAUNCH_FORCE: "closed",
    });
    const launch = loadLaunch();
    !launch.isSiteLaunched()
      ? pass("5a SITE_PRELAUNCH_FORCE=closed")
      : fail("5a force closed", "expected not launched");
  }

  // 6) TEST_NOW ignored in production
  {
    resetEnv({
      ACTIVATION_OPENS_AT: OPENS,
      ACTIVATION_TEST_NOW: BEFORE,
      NODE_ENV: "production",
    });
    const launch = loadLaunch();
    // Real now is Oct 5 2026 in user_info — before opens → still closed
    // If somehow after Oct 11 in real life this flips; assert TEST_NOW ignored:
    const forcedBefore = Date.parse(BEFORE);
    const reported = launch.getSiteLaunchNow().getTime();
    reported !== forcedBefore
      ? pass("6a production ignores ACTIVATION_TEST_NOW", `now≠BEFORE`)
      : fail("6a prod clock", "TEST_NOW was honored in production");
  }

  console.log("\n=== summary ===");
  const failed = rows.filter((r) => !r.ok);
  console.log(`${rows.length - failed.length}/${rows.length} PASS`);
  if (failed.length) {
    for (const f of failed) console.error(`FAIL ${f.id}: ${f.detail}`);
    process.exit(1);
  }
  console.log("ALL PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
