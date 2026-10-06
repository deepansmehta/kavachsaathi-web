/**
 * Snapshot + seed Firestore config/links and config/policy.
 *
 *   npx --yes tsx scripts/seed-site-config.ts
 *   npx --yes tsx scripts/seed-site-config.ts --snapshot-only
 */
import fs from "fs";
import path from "path";
import { getAdminDb } from "../src/lib/firebase-admin";
import {
  DEFAULT_LINKS,
  DEFAULT_POLICY,
  loadSiteConfig,
  saveSiteConfig,
} from "../src/lib/config/siteConfig";

async function main() {
  const snapshotOnly = process.argv.includes("--snapshot-only");
  const db = getAdminDb();
  const before = await loadSiteConfig(db);
  const outDir = path.join(process.cwd(), "docs/ops");
  fs.mkdirSync(outDir, { recursive: true });
  const snapPath = path.join(
    outDir,
    `site-config-snapshot-${Date.now()}.json`
  );
  const payload = {
    snappedAt: new Date().toISOString(),
    links: before.links,
    policy: before.policy,
  };
  fs.writeFileSync(snapPath, JSON.stringify(payload, null, 2));
  fs.writeFileSync(
    path.join(outDir, "site-config-snapshot-latest.json"),
    JSON.stringify(payload, null, 2)
  );
  console.log("SNAPSHOT", snapPath);

  if (snapshotOnly) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  await saveSiteConfig(db, {
    links: DEFAULT_LINKS,
    policy: DEFAULT_POLICY,
    updatedBy: "seed-site-config",
  });
  const after = await loadSiteConfig(db);
  console.log("SEEDED", JSON.stringify(after, null, 2));
  console.log(
    "ROLLBACK: npx --yes tsx scripts/seed-site-config.ts --restore",
    snapPath
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
