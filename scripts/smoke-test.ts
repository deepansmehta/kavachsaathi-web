/**
 * RETIRED — do not use as a CI/gate suite.
 *
 * Full Details activation (photo + 2 IDs + address + insurance + consents),
 * emergency public scrub, uploads magic-byte checks, and "500 real cards
 * untouched" are covered by:
 *
 *   scripts/e2e-full-details-smk02.ts   (primary)
 *   scripts/e2e-forms-frm01.ts          (PDF / forms)
 *   scripts/test-login-lgn01.ts         (profile login)
 *   scripts/test-advanced-features.ts   (feature flags)
 *   scripts/test-new-api-auth.ts        (auth / flag-OFF)
 *
 * Pre-launch: /api/profile/* returns 503 without preview unlock; the old
 * HTTP-only smoke path cannot activate via the 7-step wizard anymore.
 *
 * Exit 0 so this file never fails a suite that still invokes it by name.
 */
console.log(
  [
    "smoke-test.ts is RETIRED.",
    "Use: npx ts-node --skipProject --compiler-options '{\"module\":\"commonjs\",\"esModuleInterop\":true}' scripts/e2e-full-details-smk02.ts",
    "See header comment in this file for the full replacement map.",
  ].join("\n")
);
process.exit(0);
