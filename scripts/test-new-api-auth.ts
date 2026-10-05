/**
 * Security: every newly allowlisted Phase 1–3 API must NOT return 200 with data
 * when called with NO session and with feature flags OFF.
 *
 * Usage:
 *   TEST_BASE_URL=http://localhost:3000 npx ts-node --skipProject \
 *     --compiler-options '{"module":"commonjs","esModuleInterop":true}' \
 *     scripts/test-new-api-auth.ts
 */

import * as https from "https";
import * as http from "http";
import { URL } from "url";

const BASE = process.env.TEST_BASE_URL || "http://localhost:3000";

type Result = { name: string; passed: boolean; note: string };
const results: Result[] = [];

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
  opts: { method?: string; body?: string; headers?: Record<string, string> } = {}
): Promise<{ status: number; body: string; json: unknown; location?: string }> {
  const url = new URL(path, BASE);
  const isHttps = url.protocol === "https:";
  const lib = isHttps ? https : http;
  return new Promise((resolve, reject) => {
    const req = lib.request(
      {
        method: opts.method || "GET",
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        headers: {
          "Content-Type": "application/json",
          ...(opts.headers || {}),
        },
      },
      (res) => {
        let body = "";
        res.on("data", (c: Buffer) => (body += c.toString()));
        res.on("end", () => {
          let json: unknown = null;
          try {
            json = JSON.parse(body);
          } catch {
            /* ignore */
          }
          resolve({
            status: res.statusCode ?? 0,
            body,
            json,
            location: res.headers.location,
          });
        });
      }
    );
    req.on("error", reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

/** Acceptable: 401/403/404 (or 503 pre-launch). Never 200 with data payload. */
function assertNoDataLeak(
  name: string,
  res: { status: number; body: string; json: unknown }
) {
  const okStatus = [401, 403, 404, 503].includes(res.status);
  if (!okStatus) {
    fail(name, `expected 401/403/404/503, got ${res.status}`);
    return;
  }
  const j = res.json as Record<string, unknown> | null;
  if (res.status === 200) {
    fail(name, "got 200 — must not return data without session");
    return;
  }
  // If somehow 200 slipped, check for data keys
  if (j && (j.data || j.records || j.logs || j.cards || j.contacts || j.hospital || j.org)) {
    fail(name, `leaked data keys in body (status ${res.status})`);
    return;
  }
  // Body must not look like a successful data payload
  const lower = res.body.toLowerCase();
  if (
    res.status !== 503 &&
    (lower.includes('"records"') ||
      lower.includes('"cards"') ||
      lower.includes('"serial"') ||
      lower.includes('"health_id"') ||
      lower.includes('"full_name"') ||
      lower.includes('"emergency_contacts"'))
  ) {
    fail(name, `possible data leak in error body (status ${res.status})`);
    return;
  }
  pass(name, `status=${res.status}`);
}

/**
 * Newly allowlisted Phase 2/3 APIs — flags default OFF → expect 404 (or 401 if
 * flag somehow ON). Never 200 with data when called with no session.
 * alert-family (Phase 1) is intentionally public when ON; tested separately.
 */
const NEW_API_ROUTES: { name: string; path: string; method: string; body?: string }[] = [
  { name: "GET /api/cashless-timer", path: "/api/cashless-timer", method: "GET" },
  { name: "POST /api/cashless-timer", path: "/api/cashless-timer", method: "POST", body: "{}" },
  { name: "GET /api/vault", path: "/api/vault", method: "GET" },
  { name: "POST /api/vault/signed-put", path: "/api/vault/signed-put", method: "POST", body: "{}" },
  { name: "POST /api/vault/confirm", path: "/api/vault/confirm", method: "POST", body: "{}" },
  { name: "DELETE /api/vault/fake-id", path: "/api/vault/fake-id", method: "DELETE" },
  { name: "GET /api/forms/claim", path: "/api/forms/claim", method: "GET" },
  { name: "GET /api/family", path: "/api/family", method: "GET" },
  { name: "POST /api/family", path: "/api/family", method: "POST", body: "{}" },
  { name: "POST /api/family/confirm", path: "/api/family/confirm", method: "POST", body: "{}" },
  { name: "DELETE /api/family", path: "/api/family", method: "DELETE" },
  { name: "GET /api/hospital", path: "/api/hospital", method: "GET" },
  { name: "POST /api/hospital/login", path: "/api/hospital/login", method: "POST", body: "{}" },
  { name: "GET /api/hospital/admin", path: "/api/hospital/admin", method: "GET" },
  { name: "GET /api/org", path: "/api/org", method: "GET" },
  { name: "GET /api/donor-directive", path: "/api/donor-directive", method: "GET" },
  { name: "PATCH /api/donor-directive", path: "/api/donor-directive", method: "PATCH", body: "{}" },
];

async function testAlertFamilyFlagOffNote() {
  console.log("\n── Phase 1 alert-family (public when ON; no PIN) ──");
  try {
    const res = await fetch_("/api/alert-family", {
      method: "POST",
      body: JSON.stringify({ health_id: "KVS-DOES-NOT-EXIST-99999" }),
    });
    // Invalid / missing card → 400/404; never patient vault / address data
    if ([400, 404].includes(res.status)) {
      pass("POST /api/alert-family unknown id", `status=${res.status}`);
    } else if (res.status === 200) {
      fail("POST /api/alert-family unknown id", "got 200 for unknown health_id");
    } else {
      // 503 pre-launch on prod is acceptable
      if (res.status === 503) {
        pass("POST /api/alert-family unknown id", `status=503 PRE_LAUNCH`);
      } else {
        fail("POST /api/alert-family unknown id", `unexpected ${res.status}`);
      }
    }
  } catch (e) {
    fail("POST /api/alert-family unknown id", String(e));
  }
}

async function testPagesNoLeak() {
  console.log("\n── /hospital and /org pages (no session) ──");
  for (const path of ["/hospital", "/org"]) {
    try {
      const res = await fetch_(path);
      // Pre-launch → redirect coming-soon (307/302) or HTML login shell without data
      if ([301, 302, 307, 308].includes(res.status)) {
        pass(`${path} no-session redirect`, `status=${res.status} → ${res.location || "?"}`);
        continue;
      }
      if (res.status === 200) {
        const lower = res.body.toLowerCase();
        const leaked =
          lower.includes("health_id") ||
          lower.includes("kvs-2026") ||
          lower.includes("kvs-demo") ||
          lower.includes('"cards"') ||
          lower.includes("access history") && lower.includes("patient");
        // Login form / "not yet available" is OK
        if (leaked && !lower.includes("not yet available")) {
          fail(`${path} no-session`, "HTML may contain sensitive data");
        } else {
          pass(`${path} no-session`, `status=200 shell only (no inventory/PII)`);
        }
        continue;
      }
      if ([401, 403, 404, 503].includes(res.status)) {
        pass(`${path} no-session`, `status=${res.status}`);
        continue;
      }
      fail(`${path} no-session`, `unexpected status ${res.status}`);
    } catch (e) {
      fail(`${path} no-session`, String(e));
    }
  }
}

async function main() {
  console.log(`\nKavachSaathi new-API auth / flag-OFF security test`);
  console.log(`Base URL: ${BASE}`);
  console.log("═".repeat(56));
  console.log("\n── New API routes: NO session (flags default OFF for Phase 2/3) ──");

  for (const r of NEW_API_ROUTES) {
    try {
      const res = await fetch_(r.path, { method: r.method, body: r.body });
      assertNoDataLeak(`${r.method} ${r.path}`, res);
    } catch (e) {
      fail(`${r.method} ${r.path}`, String(e));
    }
  }

  await testAlertFamilyFlagOffNote();
  await testPagesNoLeak();

  console.log("\n" + "═".repeat(56));
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`Results: ${passed} passed, ${failed} failed (${results.length} total)`);
  if (failed > 0) {
    for (const r of results.filter((x) => !x.passed)) {
      console.error(`  ❌ ${r.name}: ${r.note}`);
    }
    process.exit(1);
  }
  console.log("\n✅ All auth/flag security checks passed");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
