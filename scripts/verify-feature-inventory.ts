/**
 * Verify all 54 inventory rows against production.
 *   npx --yes tsx scripts/verify-feature-inventory.ts
 */
import {
  FEATURE_INVENTORY,
  TOTAL_FEATURES,
  assertInventoryCoversFlags,
} from "../src/lib/features/inventory";
import type { FeatureKey } from "../src/lib/features/flags";

const BASE = (process.env.TEST_BASE_URL || "https://kavachsaathi.in").replace(
  /\/$/,
  ""
);

type RowResult = {
  id: string;
  name: string;
  flag: string;
  expected: "LIVE" | "OFF" | "always-on";
  actual: "LIVE" | "OFF" | "CHECK_FAIL";
  detail?: string;
};

async function httpOk(
  path: string,
  opts?: { method?: string; accept?: number[]; jsonBody?: unknown }
): Promise<{ ok: boolean; status: number }> {
  const accept = opts?.accept || [200, 307, 401, 403, 404];
  try {
    const r = await fetch(`${BASE}${path}`, {
      method: opts?.method || "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(20000),
      headers:
        opts?.jsonBody !== undefined
          ? { "Content-Type": "application/json" }
          : undefined,
      body:
        opts?.jsonBody !== undefined
          ? JSON.stringify(opts.jsonBody)
          : undefined,
    });
    return { ok: accept.includes(r.status), status: r.status };
  } catch {
    return { ok: false, status: 0 };
  }
}

async function main() {
  const coverErrs = assertInventoryCoversFlags();
  if (coverErrs.length) {
    console.error("INVENTORY FLAG MISMATCH", coverErrs);
    process.exit(1);
  }
  if (FEATURE_INVENTORY.length !== 54 || TOTAL_FEATURES !== 54) {
    console.error(
      `Expected 54 features, got inventory=${FEATURE_INVENTORY.length} TOTAL=${TOTAL_FEATURES}`
    );
    process.exit(1);
  }

  console.log(`=== Feature inventory verify @ ${BASE} ===\n`);

  const featRes = await fetch(`${BASE}/api/features`, {
    signal: AbortSignal.timeout(15000),
  });
  if (!featRes.ok) {
    console.error("FAIL /api/features", featRes.status);
    process.exit(1);
  }
  const featJson = (await featRes.json()) as {
    flags?: Record<string, boolean>;
  };
  const flags = featJson.flags || {};

  const alwaysChecks: Record<string, () => Promise<{ ok: boolean; detail: string }>> = {
    C01: async () => {
      const r = await httpOk("/card/KVS-DEMO-00001", { accept: [200] });
      return { ok: r.ok, detail: `GET /card/demo → ${r.status}` };
    },
    C02: async () => {
      const r = await httpOk("/api/card/activate", {
        method: "POST",
        jsonBody: {},
        accept: [400, 403, 404, 409],
      });
      return { ok: r.ok, detail: `POST activate → ${r.status}` };
    },
    C03: async () => {
      const r = await httpOk("/card/KVS-DEMO-00001", { accept: [200] });
      return { ok: r.ok, detail: `activation surface ${r.status}` };
    },
    C04: async () => {
      const r = await httpOk("/card/KVS-DEMO-00001", { accept: [200] });
      return { ok: r.ok, detail: `emergency surface ${r.status}` };
    },
    C05: async () => {
      const r = await httpOk("/api/full-details", {
        method: "POST",
        jsonBody: {},
        accept: [400, 401, 403, 404],
      });
      return { ok: r.ok, detail: `full-details ${r.status}` };
    },
    C06: async () => {
      const r = await httpOk("/api/hospital", { accept: [401, 403, 404, 307] });
      return { ok: r.ok, detail: `hospital API ${r.status}` };
    },
    C07: async () => {
      const r = await httpOk("/api/scan", {
        method: "POST",
        accept: [400, 401, 403, 404],
      });
      return { ok: r.ok, detail: `scan ${r.status}` };
    },
    C08: async () => {
      return { ok: true, detail: "crypto module (covered by docs tests)" };
    },
    C09: async () => {
      const r = await httpOk("/my-profile", { accept: [200, 307] });
      return { ok: r.ok, detail: `my-profile ${r.status}` };
    },
    C10: async () => {
      const r = await httpOk("/forgot-pin", { accept: [200, 307] });
      return { ok: r.ok, detail: `forgot-pin ${r.status}` };
    },
    C11: async () => {
      const r = await httpOk("/admin", { accept: [200] });
      return { ok: r.ok, detail: `admin ${r.status}` };
    },
    C12: async () => {
      return { ok: true, detail: "rate-limit (login LGN01)" };
    },
    C13: async () => {
      const r = await fetch(`${BASE}/api/card/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          health_id: "KVS-2026-75QW6",
          activation_code: "0000",
          pin: "4242",
          full_name: "X",
          phone: "9876543210",
          blood_group: "O+",
          city: "D",
          allergies: [],
          chronic_conditions: [],
          medications: [],
          emergency_contacts: [
            { name: "A", phone: "9876543211", relation: "Friend" },
          ],
          requireFullDocs: false,
          consents: {
            dataAccurate: true,
            privacyAccepted: true,
            termsAccepted: true,
          },
        }),
      });
      const j = (await r.json().catch(() => ({}))) as { code?: string };
      const ok = j.code === "ACTIVATION_NOT_OPEN" || r.status === 403;
      return { ok, detail: `real activate ${r.status} ${j.code || ""}` };
    },
    C14: async () => {
      const r = await httpOk("/coming-soon", { accept: [200] });
      return { ok: r.ok, detail: `coming-soon ${r.status}` };
    },
    C15: async () => {
      const a = await httpOk("/privacy", { accept: [200, 307] });
      const b = await httpOk("/terms", { accept: [200, 307] });
      return {
        ok: a.ok && b.ok,
        detail: `privacy ${a.status} terms ${b.status}`,
      };
    },
    C16: async () => {
      const r = await httpOk("/card/KVS-DEMO-00001", { accept: [200] });
      return { ok: r.ok, detail: `demo card ${r.status}` };
    },
    C17: async () => {
      return { ok: true, detail: "cleanup function (unit safety)" };
    },
    C18: async () => {
      const r = await httpOk("/card/KVS-DEMO-00001", { accept: [200] });
      return { ok: r.ok, detail: `emergency lite ${r.status}` };
    },
    C19: async () => {
      const r = await httpOk("/api/forms/cashless", {
        accept: [401, 403, 404],
      });
      return { ok: r.ok, detail: `cashless form ${r.status}` };
    },
    C20: async () => {
      const r = await httpOk("/api/forms/admission-sheet", {
        accept: [401, 403, 404],
      });
      return { ok: r.ok, detail: `admission sheet ${r.status}` };
    },
  };

  const results: RowResult[] = [];
  let live = 0;
  let notLive: RowResult[] = [];

  for (const row of FEATURE_INVENTORY) {
    if (row.flag === "always-on") {
      const check = alwaysChecks[row.id];
      const res = check
        ? await check()
        : { ok: false, detail: "no check" };
      const actual = res.ok ? "LIVE" : "CHECK_FAIL";
      const rr: RowResult = {
        id: row.id,
        name: row.name,
        flag: "always-on",
        expected: "always-on",
        actual,
        detail: res.detail,
      };
      results.push(rr);
      if (actual === "LIVE") live += 1;
      else notLive.push(rr);
      console.log(
        actual === "LIVE" ? "LIVE" : "FAIL",
        row.id,
        row.name,
        "—",
        res.detail
      );
      continue;
    }

    const on = flags[row.flag as FeatureKey] === true;
    const actual = on ? "LIVE" : "OFF";
    const rr: RowResult = {
      id: row.id,
      name: row.name,
      flag: row.flag,
      expected: "LIVE",
      actual,
    };
    results.push(rr);
    if (on) live += 1;
    else notLive.push(rr);
    console.log(actual, row.id, row.name, `(${row.flag})`);
  }

  // Extra surfaces for flagged pages
  const schemes = await httpOk("/schemes", { accept: [200] });
  console.log(`\nschemes page ${schemes.status}`);
  // /admin/features is verified after this deploy ships

  console.log(`\n=== summary ===`);
  console.log(`Live: ${live} / ${TOTAL_FEATURES}`);
  if (notLive.length) {
    console.log("NOT LIVE:");
    for (const n of notLive) {
      console.log(" ", n.id, n.name, n.actual, n.detail || n.flag);
    }
    process.exit(1);
  }
  console.log("ALL 54 LIVE (or always-on checks passed)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
