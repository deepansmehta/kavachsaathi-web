/**
 * Pre-launch ?preview= bypass rules.
 *
 *   npx tsx scripts/test-prelaunch-preview.ts
 */
const OPENS = "2026-10-11T12:00:00+05:30";
const BEFORE = "2026-10-11T11:59:00+05:30";
const AFTER = "2026-10-11T12:00:01+05:30";
const SECRET = "test-prelaunch-secret-32chars!!";

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
    "ACTIVATION_OPENS_AT",
    "ACTIVATION_TEST_NOW",
    "SITE_PRELAUNCH_FORCE",
    "PRELAUNCH_PREVIEW_SECRET",
    "NODE_ENV",
    "CONTEXT",
    "NETLIFY_CONTEXT",
  ]) {
    delete process.env[k];
  }
  for (const [k, v] of Object.entries(partial)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

function load() {
  const p = require.resolve("../src/lib/launchConfig");
  delete require.cache[p];
  return require("../src/lib/launchConfig") as typeof import("../src/lib/launchConfig");
}

async function main() {
  // 1) No secret env → no bypass even with cookie / param
  resetEnv({
    NODE_ENV: "production",
    ACTIVATION_OPENS_AT: OPENS,
    ACTIVATION_TEST_NOW: BEFORE,
  });
  let L = load();
  if (
    !L.isPrelaunchPreviewActive({
      previewParam: "anything",
      cookieValue: "1",
      now: new Date(BEFORE),
    })
  ) {
    pass("1 no env secret → no bypass");
  } else fail("1 no env secret → no bypass", "allowed");

  // 2) Wrong secret → no bypass
  resetEnv({
    NODE_ENV: "production",
    ACTIVATION_OPENS_AT: OPENS,
    PRELAUNCH_PREVIEW_SECRET: SECRET,
  });
  L = load();
  if (
    !L.isPrelaunchPreviewActive({
      previewParam: "wrong-secret-value!!!!!",
      cookieValue: null,
      now: new Date(BEFORE),
    })
  ) {
    pass("2 wrong secret → no bypass");
  } else fail("2 wrong secret → no bypass", "allowed");

  // 3) Correct secret before launch → bypass
  if (
    L.isPrelaunchPreviewActive({
      previewParam: SECRET,
      cookieValue: null,
      now: new Date(BEFORE),
    })
  ) {
    pass("3 correct secret before launch → bypass");
  } else fail("3 correct secret before launch → bypass", "blocked");

  // 4) Cookie alone (after secret was set) before launch → bypass
  if (
    L.isPrelaunchPreviewActive({
      previewParam: null,
      cookieValue: "1",
      now: new Date(BEFORE),
    })
  ) {
    pass("4 cookie before launch → bypass");
  } else fail("4 cookie before launch → bypass", "blocked");

  // 5) After launch → no effect even with correct secret + cookie
  if (
    !L.isPrelaunchPreviewActive({
      previewParam: SECRET,
      cookieValue: "1",
      now: new Date(AFTER),
    })
  ) {
    pass("5 after launch → no effect");
  } else fail("5 after launch → no effect", "still active");

  // 6) Unset secret in any env → no bypass (Netlify DP has no var)
  resetEnv({
    NODE_ENV: "development",
    ACTIVATION_OPENS_AT: OPENS,
  });
  L = load();
  if (
    !L.isPrelaunchPreviewActive({
      previewParam: SECRET,
      cookieValue: "1",
      now: new Date(BEFORE),
    })
  ) {
    pass("6 unset secret → no bypass");
  } else fail("6 unset secret → no bypass", "allowed");

  // 7) Cookie max-age is 2 hours
  resetEnv({ NODE_ENV: "production", PRELAUNCH_PREVIEW_SECRET: SECRET });
  L = load();
  if (L.PRELAUNCH_PREVIEW_COOKIE_MAX_AGE_SEC === 7200) {
    pass("7 cookie max-age 2h", "7200");
  } else {
    fail(
      "7 cookie max-age 2h",
      String(L.PRELAUNCH_PREVIEW_COOKIE_MAX_AGE_SEC)
    );
  }

  // 8) Short secret rejected
  resetEnv({
    NODE_ENV: "production",
    ACTIVATION_OPENS_AT: OPENS,
    PRELAUNCH_PREVIEW_SECRET: "short",
  });
  L = load();
  if (L.getPrelaunchPreviewSecret() === null) {
    pass("8 short secret rejected");
  } else fail("8 short secret rejected", "accepted");

  console.log("\n=== summary ===");
  const failed = rows.filter((r) => !r.ok).length;
  console.log(`${rows.length - failed}/${rows.length} PASS`);
  if (failed) process.exit(1);
  console.log("ALL PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
