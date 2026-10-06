/**
 * Pack 3 — 375px screenshots of new admin/profile surfaces.
 *   npx --yes tsx scripts/screenshot-pack3.ts
 */
import fs from "fs";
import path from "path";

const BASE = (process.env.TEST_BASE_URL || "http://localhost:3000").replace(
  /\/$/,
  ""
);
const OUT = path.join(process.cwd(), "tmp", "pack3-screenshots");

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 375, height: 812 },
  });

  const shots: { name: string; url: string }[] = [
    { name: "home-ref", url: `${BASE}/?ref=KSTEST01` },
    { name: "order", url: `${BASE}/order` },
    { name: "my-profile", url: `${BASE}/my-profile` },
    { name: "admin-analytics", url: `${BASE}/admin/analytics` },
    { name: "admin-validity", url: `${BASE}/admin/validity` },
    { name: "admin-pack3", url: `${BASE}/admin/pack3` },
    { name: "admin", url: `${BASE}/admin` },
  ];

  for (const s of shots) {
    try {
      await page.goto(s.url, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await page.waitForTimeout(800);
      const file = path.join(OUT, `${s.name}-375.png`);
      await page.screenshot({ path: file, fullPage: true });
      console.log("SHOT", file);
    } catch (e) {
      console.log("SKIP", s.name, e instanceof Error ? e.message : e);
    }
  }

  await browser.close();
  console.log("done →", OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
