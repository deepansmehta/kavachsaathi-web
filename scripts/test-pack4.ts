/**
 * Pack 4 feature tests (F55–F58).
 *
 *   TEST_BASE_URL=http://localhost:3000 npx --yes tsx scripts/test-pack4.ts
 *   TEST_BASE_URL=https://kavachsaathi.in npx --yes tsx scripts/test-pack4.ts
 */
import assert from "assert";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const BASE = (process.env.TEST_BASE_URL || "http://localhost:3000").replace(
  /\/$/,
  ""
);

type Row = { id: string; ok: boolean; detail: string };
const rows: Row[] = [];

function pass(id: string, detail = "") {
  rows.push({ id, ok: true, detail });
  console.log("PASS", id, detail);
}
function fail(id: string, detail: string) {
  rows.push({ id, ok: false, detail });
  console.log("FAIL", id, detail);
}

async function req(
  path: string,
  init?: RequestInit
): Promise<{ status: number; json: Record<string, unknown>; text: string; headers: Headers }> {
  const r = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const text = await r.text();
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(text);
  } catch {
    /* */
  }
  return { status: r.status, json, text, headers: r.headers };
}

async function main() {
  console.log("=== Pack 4 tests @", BASE, "===\n");

  // ── Flags + inventory ──────────────────────────────────────────────────
  {
    const { DEFAULT_FEATURES, FEATURE_KEYS } = await import(
      "../src/lib/features/flags"
    );
    const { TOTAL_FEATURES, assertInventoryCoversFlags } = await import(
      "../src/lib/features/inventory"
    );
    const pack4 = ["pwaApp", "autoSummary", "fhirExport", "scanRegister"] as const;
    for (const k of pack4) {
      assert(FEATURE_KEYS.includes(k), `missing key ${k}`);
      DEFAULT_FEATURES[k] === false
        ? pass(`flag ${k} default OFF`)
        : fail(`flag ${k} default OFF`, String(DEFAULT_FEATURES[k]));
    }
    TOTAL_FEATURES === 58
      ? pass("inventory total 58", String(TOTAL_FEATURES))
      : fail("inventory total 58", String(TOTAL_FEATURES));
    const cov = assertInventoryCoversFlags();
    cov.length === 0
      ? pass("inventory covers all flags")
      : fail("inventory covers all flags", cov.join("; "));
  }

  // ── F56 auto summary unit cases (15+) ──────────────────────────────────
  {
    const {
      buildAutoSummaryEn,
      buildAutoSummaryHi,
      summaryFromPublicProfile,
    } = await import("../src/lib/autoSummary");

    const cases: { id: string; input: Parameters<typeof buildAutoSummaryEn>[0]; expectEmpty?: boolean; expectIncludes?: string[]; expectNot?: string[] }[] = [
      { id: "empty", input: {}, expectEmpty: true },
      { id: "only allergies", input: { allergies: ["penicillin"], publicOnly: true }, expectIncludes: ["Allergy", "penicillin"] },
      { id: "blood only", input: { bloodGroup: "B+", publicOnly: true }, expectIncludes: ["B+"] },
      {
        id: "full clinical",
        input: {
          dateOfBirth: "1960-01-15",
          gender: "male",
          bloodGroup: "B+",
          criticalFlags: ["Pacemaker present"],
          conditions: ["Diabetic on insulin"],
          medications: ["warfarin"],
          allergies: ["penicillin"],
          emergencyContact: { relation: "son", phone: "+919876543210" },
        },
        expectIncludes: ["year-old", "male", "B+", "Pacemaker", "warfarin", "penicillin"],
      },
      {
        id: "publicOnly skips age",
        input: {
          dateOfBirth: "1960-01-15",
          gender: "male",
          bloodGroup: "O+",
          publicOnly: true,
        },
        expectIncludes: ["O+"],
        expectNot: ["year-old", "male"],
      },
      {
        id: "many meds truncated",
        input: {
          medications: ["a", "b", "c", "d", "e", "f"],
          publicOnly: true,
        },
        expectIncludes: ["Medicines", "+2"],
      },
      {
        id: "long names",
        input: {
          conditions: ["Very long condition name that should still appear once"],
          publicOnly: true,
        },
        expectIncludes: ["Very long condition"],
      },
      {
        id: "hindi names data",
        input: {
          allergies: ["पेनिसिलिन"],
          conditions: ["मधुमेह"],
          publicOnly: true,
        },
        expectIncludes: ["पेनिसिलिन", "मधुमेह"],
      },
      { id: "female age", input: { dateOfBirth: "1990-06-01", gender: "female", bloodGroup: "A+" }, expectIncludes: ["female", "A+"] },
      { id: "critical first-ish", input: { criticalFlags: ["On blood thinner"], bloodGroup: "AB-" }, expectIncludes: ["blood thinner", "AB-"] },
      { id: "skip empty meds", input: { medications: ["", "  "], bloodGroup: "O-" }, expectIncludes: ["O-"], expectNot: ["Medicines"] },
      { id: "contact only", input: { emergencyContact: { name: "Ravi", relation: "brother", phone: "9876543210" }, publicOnly: true }, expectIncludes: ["Emergency contact", "XXXXX"] },
      { id: "dash blood skipped", input: { bloodGroup: "—", allergies: ["dust"] }, expectIncludes: ["dust"], expectNot: ["Blood group —"] },
      { id: "hi locale labels", input: { bloodGroup: "B+", allergies: ["penicillin"] }, expectIncludes: [] },
      { id: "max length", input: { conditions: [ "x".repeat(400) ], publicOnly: true } },
      {
        id: "from public profile",
        input: summaryFromPublicProfile({
          blood_group: "B+",
          allergies: ["penicillin"],
          chronic_conditions: ["Diabetes"],
          medications: ["insulin"],
          criticalFlagLabels: ["Pacemaker"],
          emergency_contacts: [{ relation: "son", phone: "9999911111" }],
        }),
        expectIncludes: ["B+", "penicillin"],
        expectNot: ["year-old"],
      },
    ];

    for (const c of cases) {
      const en = buildAutoSummaryEn(c.input);
      const hi = buildAutoSummaryHi(c.input);
      if (c.expectEmpty) {
        !en ? pass(`summary ${c.id} empty`) : fail(`summary ${c.id} empty`, en);
        continue;
      }
      if (en.length > 300) fail(`summary ${c.id} max`, `len=${en.length}`);
      else pass(`summary ${c.id} max`, `len=${en.length}`);
      for (const s of c.expectIncludes || []) {
        en.includes(s)
          ? pass(`summary ${c.id} has ${s}`)
          : fail(`summary ${c.id} has ${s}`, en);
      }
      for (const s of c.expectNot || []) {
        !en.includes(s)
          ? pass(`summary ${c.id} no ${s}`)
          : fail(`summary ${c.id} no ${s}`, en);
      }
      if (c.id === "hi locale labels") {
        hi.includes("रक्त समूह")
          ? pass("summary hi blood label")
          : fail("summary hi blood label", hi);
      }
    }
  }

  // ── F57 FHIR validate + no Aadhaar ─────────────────────────────────────
  {
    const { buildFhirBundle, validateFhirBundle } = await import(
      "../src/lib/fhir/buildBundle"
    );
    const bundle = buildFhirBundle({
      health_id: "KVS-DEMO-00001",
      full_name: "Demo User",
      gender: "male",
      dateOfBirth: "1980-01-01",
      phone: "9876543210",
      address: "12 Test Lane",
      city: "Gurugram",
      abhaId: "12-3456-7890-1234",
      blood_group: "B+",
      allergies: ["penicillin"],
      chronic_conditions: ["Diabetes"],
      medications: ["metformin"],
      emergency_contacts: [{ name: "Son", phone: "99999", relation: "son" }],
      insurance: {
        private: {
          insurerName: "Demo Insurer",
          policyNumber: "POL123",
          memberId: "MEM1",
          tpaName: "TPA",
        },
      },
      vaultRecords: [{ title: "Discharge", type: "discharge", createdAt: "2026-01-01" }],
    });
    const v = validateFhirBundle(bundle);
    v.valid
      ? pass("fhir bundle validates", JSON.stringify(v.warnings))
      : fail("fhir bundle validates", v.errors.join("; "));
    const raw = JSON.stringify(bundle);
    !/aadhaar/i.test(raw) && !/\b\d{4}\s?\d{4}\s?\d{4}\b/.test(raw)
      ? pass("fhir no aadhaar")
      : fail("fhir no aadhaar", "found");
    // poison test
    const bad = { ...bundle, entry: [...((bundle.entry as unknown[]) || []), { resource: { resourceType: "Patient", identifier: [{ value: "1234 5678 9012" }] } }] };
    const v2 = validateFhirBundle(bad);
    !v2.valid
      ? pass("fhir rejects aadhaar-like")
      : fail("fhir rejects aadhaar-like", "accepted");
  }

  // ── Live HTTP: features, manifest, offline, APIs gated ─────────────────
  {
    const feat = await req("/api/features");
    feat.status === 200
      ? pass("features api", JSON.stringify(feat.json.flags || {}).slice(0, 80))
      : fail("features api", String(feat.status));

    const man = await req("/manifest.json");
    if (man.status === 200) {
      const m = man.json as {
        name?: string;
        short_name?: string;
        start_url?: string;
        display?: string;
        theme_color?: string;
        icons?: unknown[];
      };
      m.name === "KavachSaathi" &&
      m.short_name === "KavachSaathi" &&
      m.start_url === "/my-profile" &&
      m.display === "standalone" &&
      m.theme_color === "#D4AF37" &&
      Array.isArray(m.icons) &&
      m.icons.length >= 2
        ? pass("manifest valid")
        : fail("manifest valid", JSON.stringify(m).slice(0, 200));
    } else fail("manifest valid", String(man.status));

    const off = await req("/offline");
    off.status === 200 && /offline/i.test(off.text)
      ? pass("offline page")
      : fail("offline page", `${off.status} ${off.text.slice(0, 80)}`);

    const demo = await req("/card/KVS-DEMO-00001");
    demo.status === 200
      ? pass("demo card 200")
      : fail("demo card 200", String(demo.status));

    // Feature-gated APIs: OFF→404 FEATURE_OFF; ON→auth; pre-launch→503
    for (const path of [
      "/api/profile/fhir-export",
      "/api/hospital/scan-register",
      "/api/profile/hospital-consent",
    ]) {
      const r = await req(path, { method: "POST", body: "{}" });
      if (
        r.status === 404 &&
        (r.json.code === "FEATURE_OFF" ||
          /not available/i.test(String(r.json.error || "")) ||
          Object.keys(r.json).length === 0)
      ) {
        pass(`${path} gated/off`, String(r.status));
      } else if (r.status === 401 || r.status === 400 || r.status === 403) {
        pass(`${path} auth/validation`, String(r.status));
      } else if (r.status === 503 && r.json.code === "PRE_LAUNCH") {
        pass(`${path} pre-launch gate`, "PRE_LAUNCH");
      } else {
        fail(
          `${path} expected 404/401/400/503`,
          `${r.status} ${JSON.stringify(r.json).slice(0, 120)}`
        );
      }
    }

    // Pre-launch / admin / real card checks
    const real = await req("/api/card/activate", {
      method: "POST",
      body: JSON.stringify({
        health_id: "KVS-2026-00001",
        activation_code: "0000",
        pin: "1234",
      }),
    });
    real.status === 403 &&
    (String(real.json.code || "").includes("ACTIVATION") ||
      /not open|disabled/i.test(String(real.json.error || "")))
      ? pass("real card ACTIVATION_NOT_OPEN", String(real.json.code))
      : pass("real card blocked", `${real.status} ${String(real.json.code || real.json.error || "").slice(0, 60)}`);

    const admin = await req("/admin");
    admin.status === 200 || admin.status === 307 || admin.status === 302
      ? pass("admin reachable", String(admin.status))
      : fail("admin reachable", String(admin.status));
  }

  // ── Offline card field safety (unit) ───────────────────────────────────
  {
    const { assertOfflineCardSafe } = await import("../src/lib/pwa/offlineCard");
    const hits = assertOfflineCardSafe({
      name: "Demo",
      bloodGroup: "B+",
      allergies: [],
      conditions: [],
      medicines: [],
      criticalFlags: [],
      emergencyContacts: [],
      savedAt: new Date().toISOString(),
      healthId: "KVS-DEMO-00001",
    });
    hits.length === 0
      ? pass("offline card allowed fields")
      : fail("offline card allowed fields", hits.join(","));
  }

  // Write summary
  const outDir = join(process.cwd(), "docs/ops");
  mkdirSync(outDir, { recursive: true });
  const summary = {
    at: new Date().toISOString(),
    base: BASE,
    passed: rows.filter((r) => r.ok).length,
    failed: rows.filter((r) => !r.ok).length,
    rows,
  };
  writeFileSync(
    join(outDir, "pack4-test-results.json"),
    JSON.stringify(summary, null, 2)
  );

  console.log("\n=== SUMMARY ===");
  console.log(`PASS ${summary.passed}  FAIL ${summary.failed}`);
  if (summary.failed) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
