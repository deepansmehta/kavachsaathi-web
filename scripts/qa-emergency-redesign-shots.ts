/**
 * Screenshots + Lighthouse for emergency redesign QA.
 * Usage:
 *   PHASE=before|after npx --yes tsx scripts/qa-emergency-redesign-shots.ts
 */
import * as fs from "fs";
import * as path from "path";
import { chromium, type Page } from "playwright";
import { DEMO_HEALTH_ID } from "./demoConstants";

const BASE = (process.env.TEST_BASE_URL || "http://localhost:3000").replace(
  /\/$/,
  ""
);
const PHASE = process.env.PHASE === "after" ? "after" : "before";
const OUT = path.join(process.cwd(), "exports", `emergency-redesign-${PHASE}`);
const URL = `${BASE}/card/${DEMO_HEALTH_ID}`;

async function shot(page: Page, name: string) {
  await page.screenshot({
    path: path.join(OUT, `${name}.png`),
    fullPage: false,
  });
  console.log("shot", name);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 360, height: 800 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  await page.goto(URL, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1000);

  await shot(page, "360-top");
  await page.evaluate(() => window.scrollTo(0, 900));
  await page.waitForTimeout(300);
  await shot(page, "360-scrolled");
  await page.evaluate(() => window.scrollTo(0, 0));

  await page.setViewportSize({ width: 430, height: 900 });
  await page.waitForTimeout(200);
  await shot(page, "430-top");
  await page.evaluate(() => window.scrollTo(0, 900));
  await page.waitForTimeout(300);
  await shot(page, "430-scrolled");
  await page.evaluate(() => window.scrollTo(0, 0));

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.waitForTimeout(200);
  await shot(page, "desktop");

  await page.setViewportSize({ width: 360, height: 800 });
  await page.evaluate(() => {
    try {
      localStorage.setItem("kavach_lang", "hi");
    } catch {
      /* */
    }
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1800);
  await shot(page, "360-hindi");

  await page.evaluate(() => {
    try {
      localStorage.setItem("kavach_elderly", "1");
      document.documentElement.classList.add("ks-elderly");
    } catch {
      /* */
    }
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1800);
  await shot(page, "360-elderly");

  await browser.close();
  fs.writeFileSync(
    path.join(OUT, "meta.json"),
    JSON.stringify({ phase: PHASE, url: URL, base: BASE }, null, 2)
  );
  console.log("DONE", OUT);
  console.log(
    "Run lighthouse separately: npx lighthouse",
    URL,
    "--only-categories=performance,accessibility --form-factor=mobile"
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
