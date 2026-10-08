/**
 * Capture launch-reveal scene screenshots from reference.html (patched short DUR)
 * and optionally from a live BASE_URL with ?replayLaunch=1&lrFast=1.
 *
 *   node scripts/shot-launch-reveal.mjs
 *   BASE_URL=https://kavachsaathi.in node scripts/shot-launch-reveal.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright";
import http from "http";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "exports", "launch-reveal");
const REF = path.join(OUT, "reference.html");
const BASE = (process.env.BASE_URL || "").replace(/\/$/, "");

fs.mkdirSync(OUT, { recursive: true });

function patchReference(html) {
  return html
    .replace(
      /const DUR = \[[^\]]+\];/,
      "const DUR = [500, 600, 800, 600, 4500, null];"
    )
    .replace(/const gap=2300;/, "const gap=600;")
    .replace(
      /reduce\?10:1100\+k\*260/g,
      "reduce?10:280+k*80"
    )
    .replace(
      /reduce\?10:1100\)/g,
      "reduce?10:300)"
    )
    .replace(/\+1950\)/g, "+700)")
    .replace(/\+2000\)\)/g, "+750))");
}

async function servePatched(html) {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address();
  return { server, url: `http://127.0.0.1:${port}/` };
}

async function shot(page, name) {
  const dest = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: dest, fullPage: false });
  console.log("shot", name);
}

async function captureReference(browser) {
  const raw = fs.readFileSync(REF, "utf8");
  const { server, url } = await servePatched(patchReference(raw));
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
  });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(150);
  await shot(page, "01-countdown");
  await page.waitForTimeout(700);
  await shot(page, "02-reveal");
  await page.waitForTimeout(900);
  await shot(page, "03-legacy");
  await page.waitForTimeout(900);
  await shot(page, "04-leadership");
  await page.waitForSelector("#slot", { timeout: 5000 });
  await page.waitForTimeout(400);
  await shot(page, "05-slot-spin");
  await page.waitForSelector("#lock.show", { timeout: 8000 });
  await page.waitForTimeout(200);
  await shot(page, "06-slot-locked");
  await page.waitForSelector("#s5.on", { timeout: 8000 });
  await page.waitForTimeout(400);
  await shot(page, "07-order");
  await page.close();
  server.close();
}

async function captureLive(browser) {
  if (!BASE) {
    console.log("skip live (no BASE_URL)");
    return;
  }
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
  });
  await page.goto(`${BASE}/?replayLaunch=1`, {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });
  await page.waitForSelector("#stage .count, .ks-launch-root .count", {
    timeout: 30000,
  });
  await page.waitForTimeout(800);
  await shot(page, "live-01-countdown");
  // Wait through to slot (~30+6.5+10+7.5 ≈ 54s) then capture
  console.log("waiting for slot scene (~55s)…");
  await page.waitForSelector(".ks-launch-root .slot, #slot", {
    timeout: 90000,
  });
  await page.waitForTimeout(2500);
  await shot(page, "live-05-slot");
  await page.waitForSelector(".ks-launch-root .home, a.home, button.home", {
    timeout: 30000,
  });
  await page.waitForTimeout(600);
  await shot(page, "live-07-order");
  await page.close();
}

const browser = await chromium.launch({ headless: true });
try {
  await captureReference(browser);
  await captureLive(browser);
} finally {
  await browser.close();
}
console.log("done →", OUT);
