/**
 * Launch-reveal verification E2E (Playwright).
 *
 * Local (API time mocked — no device clock):
 *   BASE_URL=http://127.0.0.1:3011 npx --yes tsx scripts/e2e-launch-reveal-verify.ts
 *
 * Live rehearsal (preview cookie + replayLaunch):
 *   MODE=live BASE_URL=https://kavachsaathi.in \
 *   PRELAUNCH_PREVIEW_SECRET=… npx --yes tsx scripts/e2e-launch-reveal-verify.ts
 */
import fs from "fs";
import path from "path";
import { chromium, type Page, type BrowserContext } from "playwright";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:3011").replace(
  /\/$/,
  ""
);
const MODE = process.env.MODE === "live" ? "live" : "local";
const OUT = path.join(
  process.cwd(),
  "exports",
  "launch-reveal",
  process.env.SHOT_DIR === "final" ? "final" : "live"
);
const START_MS = Date.parse("2026-10-11T12:00:00+05:30");
const T0 = Date.parse("2026-10-11T11:59:50+05:30"); // 10s before noon

fs.mkdirSync(OUT, { recursive: true });

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

async function shot(page: Page, name: string) {
  await page.screenshot({
    path: path.join(OUT, `${name}.png`),
    fullPage: false,
  });
  console.log("shot", name);
}

/** Mock /api/time + /api/launch-reveal/status advancing from T0. */
async function installTimeMock(context: BrowserContext, opts: {
  startAt: number;
  rate?: number; // simulated ms per real ms
}) {
  const wall0 = Date.now();
  const rate = opts.rate ?? 1000; // 1 simulated second per real ms * rate/1000
  const nowFn = () => opts.startAt + (Date.now() - wall0) * (rate / 1000);

  await context.route("**/api/time", async (route) => {
    const nowMs = Math.floor(nowFn());
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        nowMs,
        nowIso: new Date(nowMs).toISOString(),
        tz: "Asia/Kolkata",
      }),
    });
  });

  await context.route("**/api/launch-reveal/status**", async (route) => {
    const nowMs = Math.floor(nowFn());
    const url = new URL(route.request().url());
    const p = url.searchParams.get("path") || "/";
    const pathOk =
      p === "/" || p === "" || p === "/coming-soon";
    const inWindow =
      nowMs >= START_MS &&
      nowMs <= Date.parse("2026-10-11T23:59:59.999+05:30");
    const beforeLaunch = nowMs < START_MS;
    const neverAfter = nowMs >= Date.parse("2026-10-12T00:00:00+05:30");
    const canReplay = false; // local mock never grants replay
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        nowMs,
        nowIso: new Date(nowMs).toISOString(),
        pathOk,
        inWindow,
        beforeLaunch,
        neverAfter,
        canReplay,
        mayLoadBundle: pathOk && !neverAfter && (inWindow || canReplay),
        windowStartMs: START_MS,
        windowEndMs: Date.parse("2026-10-11T23:59:59.999+05:30"),
        neverAfterMs: Date.parse("2026-10-12T00:00:00+05:30"),
      }),
    });
  });

  return nowFn;
}

async function waitReveal(page: Page, timeout = 90000) {
  await page.waitForSelector(".ks-launch-root #stage", { timeout });
}

async function localE2E() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    locale: "en-IN",
  });
  // Fast-forward: 10 simulated seconds in ~1.5 real seconds, then normal
  const nowFn = await installTimeMock(context, { startAt: T0, rate: 7000 });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  // Clear once before first navigation — do NOT use addInitScript (runs on every load)
  await page.goto(`${BASE}/coming-soon`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    try {
      localStorage.removeItem("kavach_launch_reveal_seen_v1");
    } catch {
      /* */
    }
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);
  await shot(page, "00-coming-soon-before-noon");

  // Wait until mocked clock crosses noon + reveal mounts
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    if (nowFn() >= START_MS) break;
    await page.waitForTimeout(200);
  }
  try {
    await waitReveal(page, 60000);
    pass("E2E-autoplay", "reveal mounted after noon");
  } catch (e) {
    fail("E2E-autoplay", String(e));
    await shot(page, "FAIL-no-reveal");
    await browser.close();
    return;
  }

  // Scene screenshots EN — reveal → legacy → leadership → birthday → slot → order
  const sceneIds = ["s1", "s2", "s3", "s3b", "s4", "s5"];
  const names = [
    "01-reveal",
    "02-legacy",
    "03-leadership",
    "04-birthday",
    "05-slot",
    "06-order",
  ];
  for (let i = 0; i < sceneIds.length; i++) {
    try {
      await page.waitForSelector(`#${sceneIds[i]}.on`, { timeout: 22000 });
      await page.waitForTimeout(400);
      await shot(page, `en-390-${names[i]}`);
      if (sceneIds[i] === "s3b") {
        const photoOk = await page.evaluate(() => {
          const els = [...document.querySelectorAll("#s3b .av2.photo")] as HTMLElement[];
          return els.length === 2 && els.every((e) => (e.style.backgroundImage || "").includes("birthday"));
        });
        photoOk
          ? pass("E2E-birthday-photos", "webp paths present")
          : fail("E2E-birthday-photos", "missing photo bg");
      }
      if (sceneIds[i] === "s4") {
        await page.waitForTimeout(9500);
        await shot(page, "en-390-05b-slot-locked");
      }
    } catch (e) {
      fail(`E2E-scene-${sceneIds[i]}`, String(e));
      await shot(page, `FAIL-${names[i]}`);
    }
  }

  // Finish reveal via Go Home
  try {
    await page.waitForSelector("#s5.on button.home, #s5.on .home", {
      timeout: 25000,
    });
    await page.click("#s5.on button.home, #s5.on .home");
    await page.waitForTimeout(1500);
    const url = page.url();
    if (url.includes("/coming-soon") === false || url.endsWith("/")) {
      pass("E2E-home", `after reveal → ${url}`);
    } else {
      fail("E2E-home", url);
    }
    await shot(page, "06-after-home");
  } catch (e) {
    fail("E2E-home", String(e));
  }

  // Reload → no reveal
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  const still = await page.locator(".ks-launch-root").count();
  still === 0
    ? pass("E2E-second-visit", "no reveal")
    : fail("E2E-second-visit", "reveal still present");

  // Mock 12 Oct → no reveal bundle
  await context.unroute("**/api/launch-reveal/status**");
  await context.unroute("**/api/time");
  const oct12 = Date.parse("2026-10-12T00:00:01+05:30");
  await context.route("**/api/time", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        nowMs: oct12,
        nowIso: new Date(oct12).toISOString(),
      }),
    });
  });
  await context.route("**/api/launch-reveal/status**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        nowMs: oct12,
        pathOk: true,
        inWindow: false,
        beforeLaunch: false,
        neverAfter: true,
        canReplay: false,
        mayLoadBundle: false,
      }),
    });
  });
  try {
    localStorageClear: await page.evaluate(() => {
      try {
        localStorage.removeItem("kavach_launch_reveal_seen_v1");
      } catch {
        /* */
      }
    });
  } catch {
    /* */
  }
  const requested: string[] = [];
  page.on("request", (req) => {
    const u = req.url();
    // Bundle / chunk only — ignore /api/launch-reveal/status
    if (
      /LaunchReveal|launch-reveal\.(css|js)|\/_next\/static\/.*[Ll]aunch/.test(
        u
      )
    ) {
      requested.push(u);
    }
  });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  const root = await page.locator(".ks-launch-root").count();
  root === 0 && requested.length === 0
    ? pass("E2E-oct12-no-js", "no reveal mount/request")
    : fail(
        "E2E-oct12-no-js",
        `root=${root} reqs=${requested.length}`
      );

  const realErrors = errors.filter(
    (e) =>
      !/favicon|hydration|Failed to load resource.*404/i.test(e) &&
      !/net::ERR_/i.test(e)
  );
  realErrors.length === 0
    ? pass("E2E-no-errors", `${errors.length} console notes filtered`)
    : fail("E2E-no-errors", realErrors.slice(0, 5).join(" | "));

  // HI screenshots — re-run short path with lang if site supports; else re-capture order with hi font
  await context.close();

  // Second context for HI labels (same EN UI with Devanagari already visible on scenes)
  const ctxHi = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    locale: "hi-IN",
  });
  await installTimeMock(ctxHi, { startAt: START_MS + 500, rate: 1 });
  const pageHi = await ctxHi.newPage();
  await pageHi.goto(`${BASE}/coming-soon`, { waitUntil: "domcontentloaded" });
  await pageHi.evaluate(() => {
    try {
      localStorage.removeItem("kavach_launch_reveal_seen_v1");
    } catch {
      /* */
    }
  });
  await pageHi.reload({ waitUntil: "domcontentloaded" });
  try {
    await waitReveal(pageHi, 30000);
    const hiScenes = ["s1", "s2", "s3", "s3b", "s4", "s5"];
    const hiNames = [
      "hi-390-01-reveal",
      "hi-390-02-legacy",
      "hi-390-03-leadership",
      "hi-390-04-birthday",
      "hi-390-05-slot",
      "hi-390-06-order",
    ];
    for (let i = 0; i < hiScenes.length; i++) {
      await pageHi.waitForSelector(`#${hiScenes[i]}.on`, { timeout: 22000 });
      await pageHi.waitForTimeout(350);
      await shot(pageHi, hiNames[i]);
      if (hiScenes[i] === "s4") await pageHi.waitForTimeout(9500);
    }
    pass("E2E-hi-shots", "captured");
  } catch (e) {
    fail("E2E-hi-shots", String(e));
  }
  await ctxHi.close();

  // Extra viewports EN (360×740, 1280×800) — one scene each for size proof + full birthday
  for (const vp of [
    { w: 360, h: 740, tag: "360" },
    { w: 1280, h: 800, tag: "1280" },
  ] as const) {
    const ctx = await browser.newContext({
      viewport: { width: vp.w, height: vp.h },
      deviceScaleFactor: 1,
    });
    await installTimeMock(ctx, { startAt: START_MS + 500, rate: 1 });
    const p = await ctx.newPage();
    await p.goto(`${BASE}/coming-soon`, { waitUntil: "domcontentloaded" });
    await p.evaluate(() => {
      try {
        localStorage.removeItem("kavach_launch_reveal_seen_v1");
      } catch {
        /* */
      }
    });
    await p.reload({ waitUntil: "domcontentloaded" });
    try {
      await waitReveal(p, 30000);
      for (const sid of ["s1", "s2", "s3", "s3b", "s4", "s5"]) {
        await p.waitForSelector(`#${sid}.on`, { timeout: 22000 });
        await p.waitForTimeout(300);
        await shot(p, `${vp.tag}-${sid}`);
        if (sid === "s4") await p.waitForTimeout(9000);
      }
      pass(`E2E-vp-${vp.tag}`, "all scenes");
    } catch (e) {
      fail(`E2E-vp-${vp.tag}`, String(e));
    }
    await ctx.close();
  }

  // Reduced motion: fades only, no canvas particles expected
  {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: "reduce",
    });
    await installTimeMock(ctx, { startAt: START_MS + 500, rate: 1 });
    const p = await ctx.newPage();
    await p.goto(`${BASE}/coming-soon`, { waitUntil: "domcontentloaded" });
    await p.evaluate(() => {
      try {
        localStorage.removeItem("kavach_launch_reveal_seen_v1");
      } catch {
        /* */
      }
    });
    await p.reload({ waitUntil: "domcontentloaded" });
    try {
      await waitReveal(p, 30000);
      await p.waitForSelector("#s1.on", { timeout: 10000 });
      const flashHidden = await p.evaluate(() => {
        const f = document.querySelector(".ks-launch-root .flash");
        if (!f) return true;
        return getComputedStyle(f).display === "none";
      });
      flashHidden
        ? pass("E2E-reduced-motion", "flash/heavy FX suppressed")
        : fail("E2E-reduced-motion", "flash still visible");
      await shot(p, "reduced-motion-s1");
    } catch (e) {
      fail("E2E-reduced-motion", String(e));
    }
    await ctx.close();
  }

  // Oct 10 → no reveal; /card paths → no reveal JS
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const oct10 = Date.parse("2026-10-10T12:00:00+05:30");
    await ctx.route("**/api/time", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, nowMs: oct10 }),
      });
    });
    await ctx.route("**/api/launch-reveal/status**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          nowMs: oct10,
          pathOk: true,
          inWindow: false,
          beforeLaunch: true,
          neverAfter: false,
          canReplay: false,
          mayLoadBundle: false,
        }),
      });
    });
    const p = await ctx.newPage();
    const reqs: string[] = [];
    p.on("request", (req) => {
      const u = req.url();
      if (/LaunchReveal|launch-reveal\.(css|js)|\/_next\/static\/.*[Ll]aunch/.test(u))
        reqs.push(u);
    });
    await p.goto(`${BASE}/coming-soon`, { waitUntil: "networkidle" });
    await p.waitForTimeout(1500);
    (await p.locator(".ks-launch-root").count()) === 0 && reqs.length === 0
      ? pass("E2E-oct10-no-js", "no reveal")
      : fail("E2E-oct10-no-js", `root reqs=${reqs.length}`);
    reqs.length = 0;
    await p.goto(`${BASE}/card/DEMO`, { waitUntil: "networkidle" });
    await p.waitForTimeout(1200);
    (await p.locator(".ks-launch-root").count()) === 0 && reqs.length === 0
      ? pass("E2E-card-no-js", "/card/DEMO clean")
      : fail("E2E-card-no-js", `reqs=${reqs.length}`);
    await ctx.close();
  }

  // CPU 4× slowdown — long frames during fireworks
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await installTimeMock(ctx, { startAt: START_MS + 500, rate: 1 });
    const p = await ctx.newPage();
    const cdp = await ctx.newCDPSession(p);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await p.goto(`${BASE}/coming-soon`, { waitUntil: "domcontentloaded" });
    await p.evaluate(() => {
      try {
        localStorage.removeItem("kavach_launch_reveal_seen_v1");
      } catch {
        /* */
      }
    });
    await p.reload({ waitUntil: "domcontentloaded" });
    try {
      await waitReveal(p, 40000);
      const longFrames = await p.evaluate(`(() => new Promise((resolve) => {
        let bad = 0;
        let n = 0;
        let last = performance.now();
        const tick = (t) => {
          const dt = t - last;
          last = t;
          if (dt > 100) bad += 1;
          n += 1;
          if (n < 180) requestAnimationFrame(tick);
          else resolve(bad);
        };
        requestAnimationFrame(tick);
      }))()`);
      // Allow a few spikes on CI/headless; fail hard if sustained jank
      Number(longFrames) <= 12
        ? pass("E2E-cpu4x", `longFrames>100ms = ${longFrames}`)
        : fail("E2E-cpu4x", `too many long frames: ${longFrames}`);
    } catch (e) {
      fail("E2E-cpu4x", String(e));
    }
    await ctx.close();
  }

  await browser.close();
}

async function liveRehearsal() {
  const secret = String(process.env.PRELAUNCH_PREVIEW_SECRET || "").trim();
  if (secret.length < 16) {
    fail("LIVE-preview", "PRELAUNCH_PREVIEW_SECRET missing");
    return;
  }
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  // Set preview cookie via secret URL
  await page.goto(`${BASE}/?preview=${encodeURIComponent(secret)}`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForTimeout(1500);
  await page.goto(`${BASE}/?replayLaunch=1`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  try {
    await page.waitForSelector(".ks-launch-root", { timeout: 20000 });
    pass("LIVE-replay", "reveal mounted");
    await shot(page, "live-rehearsal-countdown");
    // Skip ahead by waiting for order scene (30s + scenes ~35s) — too long; jump via evaluating mark
    // Wait for order scene up to 90s
    await page.waitForSelector("#s5.on", { timeout: 120000 });
    await shot(page, "live-rehearsal-order");
    // Fill demo order
    await page.fill('#order input[name="name"], #order input#o-name', "Rehearsal User");
    await page.fill('#order input[name="phone"], #order input#o-phone', "9876543210");
    await page.fill(
      '#order textarea[name="address"], #order textarea#o-addr',
      "House 1 Test Street Fatehabad 125050"
    );
    await page.click("#order button.cta, #order button[type=submit]");
    await page.waitForTimeout(1500);
    const body = await page.locator("#order .ok, #order .help").allTextContents();
    const text = body.join(" ");
    /Demo — not saved/i.test(text)
      ? pass("LIVE-demo-order", text.slice(0, 80))
      : fail("LIVE-demo-order", text || "no demo message");
    await shot(page, "live-rehearsal-demo-order");
  } catch (e) {
    fail("LIVE-replay", String(e));
    await shot(page, "FAIL-live-rehearsal");
  }
  await browser.close();
}

async function main() {
  console.log(`MODE=${MODE} BASE=${BASE}`);
  if (MODE === "live") await liveRehearsal();
  else await localE2E();
  const failed = rows.filter((r) => !r.ok);
  console.log(
    `\nSUMMARY ${rows.filter((r) => r.ok).length}/${rows.length} pass`
  );
  fs.writeFileSync(
    path.join(OUT, "e2e-results.json"),
    JSON.stringify({ MODE, BASE, rows }, null, 2)
  );
  if (failed.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
