/**
 * Pack 2 — 375px screenshots
 *   TEST_BASE_URL=https://kavachsaathi.in npx --yes tsx scripts/screenshot-pack2.ts
 */
import fs from "fs";
import path from "path";

const BASE = (process.env.TEST_BASE_URL || "http://localhost:3000").replace(
  /\/$/,
  ""
);
const OUT = path.join(process.cwd(), "tmp", "pack2-screenshots");

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 375, height: 812 },
  });
  const shots = [
    { name: "schemes", url: `${BASE}/schemes` },
    { name: "demo-card", url: `${BASE}/card/KVS-DEMO-00001` },
    { name: "admin", url: `${BASE}/admin` },
    { name: "my-profile-gate", url: `${BASE}/my-profile` },
  ];
  for (const s of shots) {
    try {
      await page.goto(s.url, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await page.waitForTimeout(1000);
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
