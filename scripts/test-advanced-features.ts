/**
 * test-advanced-features.ts
 * Tests Phase 2 & 3 feature flags: OFF → 404, ON → works for key APIs.
 *
 * Usage:
 *   FEATURE_CASHLESS_TIMER=true ts-node scripts/test-advanced-features.ts
 *   FEATURE_RECORDS_VAULT=true ts-node scripts/test-advanced-features.ts
 *
 * Environment:
 *   TEST_BASE_URL   - defaults to http://localhost:3000
 *   FEATURE_*       - override individual feature flags
 */

import * as https from "https";
import * as http from "http";
import { URL } from "url";

const BASE = process.env.TEST_BASE_URL || "http://localhost:3000";

type TestResult = {
  name: string;
  passed: boolean;
  note: string;
};

const results: TestResult[] = [];

function pass(name: string, note = "") {
  results.push({ name, passed: true, note });
  console.log(`  ✅ PASS  ${name}${note ? "  — " + note : ""}`);
}

function fail(name: string, note: string) {
  results.push({ name, passed: false, note });
  console.error(`  ❌ FAIL  ${name}  — ${note}`);
}

async function fetch_(
  path: string,
  opts: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    cookie?: string;
  } = {}
): Promise<{ status: number; body: string; json: unknown }> {
  const url = new URL(path, BASE);
  const isHttps = url.protocol === "https:";
  const lib = isHttps ? https : http;

  return new Promise((resolve, reject) => {
    const reqOpts: http.RequestOptions = {
      method: opts.method || "GET",
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      headers: {
        "Content-Type": "application/json",
        ...(opts.cookie ? { Cookie: opts.cookie } : {}),
        ...(opts.headers || {}),
      },
    };

    const req = lib.request(reqOpts, (res) => {
      let body = "";
      res.on("data", (chunk: Buffer) => {
        body += chunk.toString();
      });
      res.on("end", () => {
        let json: unknown = null;
        try {
          json = JSON.parse(body);
        } catch {
          /* not json */
        }
        resolve({ status: res.statusCode ?? 0, body, json });
      });
    });

    req.on("error", reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

/** Test that a feature API returns 404 when flag is off */
async function testFlagOff(name: string, path: string, method = "GET") {
  try {
    const res = await fetch_(path, { method });
    if (res.status === 404) {
      pass(`${name} flag-OFF → 404`, `status=${res.status}`);
    } else {
      fail(`${name} flag-OFF`, `expected 404, got ${res.status}`);
    }
  } catch (e) {
    fail(`${name} flag-OFF`, String(e));
  }
}

/** Test that a feature API returns non-404 when flag is on (may need auth → expect 401 not 404) */
async function testFlagOn(
  name: string,
  path: string,
  method = "GET",
  expectedStatuses: number[] = [200, 401, 403]
) {
  try {
    const res = await fetch_(path, { method });
    if (expectedStatuses.includes(res.status)) {
      pass(`${name} flag-ON → not 404`, `status=${res.status}`);
    } else {
      fail(`${name} flag-ON`, `expected one of ${expectedStatuses.join(",")}, got ${res.status}`);
    }
  } catch (e) {
    fail(`${name} flag-ON`, String(e));
  }
}

/** Test features endpoint */
async function testFeaturesEndpoint() {
  console.log("\n── GET /api/features ──");
  try {
    const res = await fetch_("/api/features");
    if (res.status === 200) {
      const d = res.json as { flags?: Record<string, unknown> };
      if (d.flags && typeof d.flags === "object") {
        const phase2Keys = [
          "cashlessTimer",
          "recordsVault",
          "claimFormPrefill",
          "familyPlan",
          "abhaLink",
          "hospitalPortal",
          "orgDashboard",
          "regionalLang",
        ];
        const phase3Keys = ["donorDirective", "nfcInfo"];
        const allOff = [...phase2Keys, ...phase3Keys].every(
          (k) => d.flags![k] === false
        );
        if (allOff) {
          pass("/api/features Phase 2+3 default OFF", JSON.stringify(d.flags));
        } else {
          const onFlags = [...phase2Keys, ...phase3Keys].filter((k) => d.flags![k]);
          console.log(`  ℹ  Some flags ON (env override?): ${onFlags.join(", ")}`);
          pass("/api/features returns flags", "");
        }
      } else {
        fail("/api/features", "flags object missing");
      }
    } else {
      fail("/api/features", `status ${res.status}`);
    }
  } catch (e) {
    fail("/api/features", String(e));
  }
}

/** Test Phase 1 still accessible */
async function testPhase1() {
  console.log("\n── Phase 1 APIs (should work) ──");
  try {
    const r = await fetch_("/api/emergency", {
      method: "POST",
      body: JSON.stringify({ health_id: "KVS-TEST-00001", mode: "emergency" }),
    });
    if ([200, 400, 404, 422].includes(r.status)) {
      pass("POST /api/emergency reachable", `status=${r.status}`);
    } else if (r.status === 503) {
      console.log("  ℹ  /api/emergency → 503 (pre-launch gate active)");
    }
  } catch (e) {
    fail("POST /api/emergency", String(e));
  }
}

async function runTests() {
  console.log(`\nKavachSaathi Advanced Features Test`);
  console.log(`Base URL: ${BASE}`);
  console.log("═".repeat(48));

  await testFeaturesEndpoint();
  await testPhase1();

  console.log("\n── F4 cashlessTimer ──");
  await testFlagOff("F4 cashlessTimer", "/api/cashless-timer", "GET");
  await testFlagOff("F4 cashlessTimer POST", "/api/cashless-timer", "POST");

  console.log("\n── F5 recordsVault ──");
  await testFlagOff("F5 vault GET", "/api/vault", "GET");
  await testFlagOff("F5 vault signed-put", "/api/vault/signed-put", "POST");
  await testFlagOff("F5 vault confirm", "/api/vault/confirm", "POST");
  await testFlagOff("F5 vault delete", "/api/vault/test-id", "DELETE");

  console.log("\n── F6 claimFormPrefill ──");
  await testFlagOff("F6 forms/claim", "/api/forms/claim", "GET");

  console.log("\n── F7 familyPlan ──");
  await testFlagOff("F7 family GET", "/api/family", "GET");
  await testFlagOff("F7 family POST", "/api/family", "POST");
  await testFlagOff("F7 family confirm", "/api/family/confirm", "POST");
  await testFlagOff("F7 family DELETE", "/api/family", "DELETE");

  console.log("\n── F9 hospitalPortal ──");
  await testFlagOff("F9 hospital login", "/api/hospital/login", "POST");
  await testFlagOff("F9 hospital GET", "/api/hospital", "GET");
  await testFlagOff("F9 hospital admin", "/api/hospital/admin", "GET");

  console.log("\n── F10 orgDashboard ──");
  await testFlagOff("F10 org GET", "/api/org", "GET");

  console.log("\n── F12 donorDirective ──");
  await testFlagOff("F12 donor GET", "/api/donor-directive", "GET");
  await testFlagOff("F12 donor PATCH", "/api/donor-directive", "PATCH");

  // If any feature flag is explicitly on via env, test that it returns non-404
  const envFlagMap: Record<string, { path: string; method: string }> = {
    FEATURE_CASHLESS_TIMER: { path: "/api/cashless-timer", method: "GET" },
    FEATURE_RECORDS_VAULT: { path: "/api/vault", method: "GET" },
    FEATURE_CLAIM_FORM_PREFILL: { path: "/api/forms/claim", method: "GET" },
    FEATURE_FAMILY_PLAN: { path: "/api/family", method: "GET" },
    FEATURE_HOSPITAL_PORTAL: { path: "/api/hospital", method: "GET" },
    FEATURE_ORG_DASHBOARD: { path: "/api/org", method: "GET" },
    FEATURE_DONOR_DIRECTIVE: { path: "/api/donor-directive", method: "GET" },
  };

  const enabledFeatures = Object.entries(envFlagMap).filter(([k]) => {
    const v = process.env[k];
    return v === "1" || v === "true" || v === "on";
  });

  if (enabledFeatures.length > 0) {
    console.log("\n── ENV-enabled flags → non-404 check ──");
    for (const [envKey, { path, method }] of enabledFeatures) {
      await testFlagOn(`${envKey} ON`, path, method, [200, 401, 403]);
    }
  }

  // Summary
  console.log("\n" + "═".repeat(48));
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`Results: ${passed} passed, ${failed} failed (${results.length} total)`);

  if (failed > 0) {
    console.error("\nFailed tests:");
    for (const r of results.filter((r) => !r.passed)) {
      console.error(`  ❌ ${r.name}: ${r.note}`);
    }
    process.exit(1);
  } else {
    console.log("\n✅ All tests passed");
    process.exit(0);
  }
}

runTests().catch((e) => {
  console.error("Test runner error:", e);
  process.exit(1);
});
