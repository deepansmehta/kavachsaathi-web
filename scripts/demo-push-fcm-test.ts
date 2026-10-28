/**
 * DEMO-ONLY: VAPID + FCM opt-in + Admin test notification.
 * Never prints tokens / VAPID / PINs.
 */
import * as fs from "fs";
import * as path from "path";
import { chromium } from "playwright";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { DEMO_HEALTH_ID } from "./demoConstants";

const BASE = (process.env.TEST_BASE_URL || "https://kavachsaathi.in").replace(
  /\/$/,
  ""
);
const PIN = "482913";

function loadEnv() {
  const p = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m && !process.env[m[1].trim()]) {
      process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  }
}

function admin() {
  loadEnv();
  if (!getApps().length) {
    const sa = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "service-account.json"), "utf8")
    );
    initializeApp({ credential: cert(sa), projectId: sa.project_id });
  }
  return { db: getFirestore(), messaging: getMessaging() };
}

function pass(n: string, note?: string) {
  console.log(`PASS  ${n}${note ? " — " + note : ""}`);
}
function fail(n: string, note?: string) {
  console.log(`FAIL  ${n}${note ? " — " + note : ""}`);
  process.exitCode = 1;
}

async function main() {
  if (DEMO_HEALTH_ID !== "KVS-DEMO-00001") throw new Error("ABORT");
  const { db, messaging } = admin();
  const card = await db.collection("cards").doc(DEMO_HEALTH_ID).get();
  if (!card.exists || card.data()?.isDemo !== true) throw new Error("REFUSED");
  const profileId = String(card.data()?.linkedProfileId || "");
  if (!profileId) throw new Error("no profile");

  console.log("base:", BASE);

  const swHttp = await fetch(`${BASE}/firebase-messaging-sw.js`);
  if (swHttp.ok) pass("messaging-sw-served");
  else fail("messaging-sw-served", String(swHttp.status));

  const login = await fetch(`${BASE}/api/profile/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ health_id: DEMO_HEALTH_ID, pin: PIN }),
  });
  const setCookie = login.headers.getSetCookie?.() || [];
  const cookieHeader = setCookie.map((c) => c.split(";")[0]).join("; ");
  if (!login.ok || !cookieHeader) {
    fail("demo-login", String(login.status));
    return;
  }
  pass("demo-login");

  await fetch(`${BASE}/api/policies/reminders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookieHeader },
    body: JSON.stringify({ push: false, fcmToken: null }),
  });

  // Prefer headed Chromium — headless often forces Notification.permission=denied
  let browser;
  try {
    browser = await chromium.launch({
      headless: false,
      channel: "chrome",
      args: ["--disable-extensions"],
    });
  } catch {
    browser = await chromium.launch({ headless: false });
  }
  const context = await browser.newContext({ serviceWorkers: "allow" });
  await context.grantPermissions(["notifications"], { origin: BASE });
  try {
    const page0 = await context.newPage();
    const cdp = await context.newCDPSession(page0);
    await cdp.send("Browser.grantPermissions", {
      origin: BASE,
      permissions: ["notifications"],
    });
    await page0.close();
  } catch {
    /* */
  }
  for (const part of cookieHeader.split("; ")) {
    const [name, ...rest] = part.split("=");
    if (!name) continue;
    await context.addCookies([
      {
        name,
        value: rest.join("="),
        domain: "kavachsaathi.in",
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "Lax",
      },
    ]);
  }
  const page = await context.newPage();
  const posts: { push?: boolean; tokenLen: number }[] = [];
  page.on("request", (req) => {
    if (
      req.method() === "POST" &&
      req.url().includes("/api/policies/reminders")
    ) {
      try {
        const b = req.postDataJSON() || {};
        posts.push({
          push: !!b.push,
          tokenLen: String(b.fcmToken || "").length,
        });
      } catch {
        /* */
      }
    }
  });

  try {
    const cdp = await context.newCDPSession(page);
    await cdp.send("Browser.grantPermissions", {
      origin: BASE,
      permissions: ["notifications"],
    });
  } catch {
    /* */
  }
  await page.goto(
    `${BASE}/my-profile?health_id=${encodeURIComponent(DEMO_HEALTH_ID)}&section=policies`,
    { waitUntil: "domcontentloaded", timeout: 60000 }
  );
  await page.waitForTimeout(3000);

  // Timed SW register (no hang) — plain JS string avoids tsx __name in page world
  const sw = await page.evaluate(`(async () => {
    function race(p, ms) {
      return Promise.race([
        p,
        new Promise(function (r) { setTimeout(function () { r({ timeout: true }); }, ms); }),
      ]);
    }
    try {
      var reg = await navigator.serviceWorker.register(
        "/firebase-messaging-sw.js",
        { scope: "/firebase-cloud-messaging-push-scope" }
      );
      var ready = await race(navigator.serviceWorker.ready, 5000);
      return {
        ok: true,
        scope: reg.scope,
        perm: Notification.permission,
        readyTimedOut: !!(ready && ready.timeout),
      };
    } catch (e) {
      return {
        ok: false,
        err: String((e && e.message) || e).slice(0, 140),
        perm: typeof Notification !== "undefined" ? Notification.permission : "n/a",
      };
    }
  })()`);
  console.log("sw", JSON.stringify(sw));

  const enable = page.getByRole("button", { name: /Enable push reminders/i });
  if (await enable.count()) {
    pass("found-enable-button");
    await enable.click({ timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(12000);
  } else {
    fail("found-enable-button");
  }

  const rem = await fetch(`${BASE}/api/policies/reminders`, {
    headers: { Cookie: cookieHeader },
  });
  const j = (await rem.json()) as {
    reminderPrefs?: { push?: boolean; fcmToken?: string | null };
  };
  let tok = String(j.reminderPrefs?.fcmToken || "");
  console.log("client_posts", JSON.stringify(posts));

  const prof = await db.collection("profiles").doc(profileId).get();
  tok = String(
    (prof.data()?.policyReminderPrefs as { fcmToken?: string } | undefined)
      ?.fcmToken || tok
  );

  if (tok.length > 80) {
    pass("browser-fcm-optin", `token_len=${tok.length}`);
    try {
      const msgId = await messaging.send({
        token: tok,
        notification: {
          title: "KavachSaathi test",
          body: "DEMO push opt-in OK — Policy Saathi",
        },
        data: { type: "policy_reminder_test", health_id: DEMO_HEALTH_ID },
        webpush: {
          fcmOptions: {
            link: `${BASE}/my-profile?health_id=${DEMO_HEALTH_ID}`,
          },
        },
      });
      pass("test-notification-send", `id_len=${String(msgId).length}`);
    } catch (e) {
      fail(
        "test-notification-send",
        String(e instanceof Error ? e.message : e)
          .replace(/[A-Za-z0-9_-]{80,}/g, "[redacted]")
          .slice(0, 180)
      );
    }
  } else {
    fail(
      "browser-fcm-optin",
      "no token from automated browser (Push API often blocked in headless). Falling back to API opt-in + Admin FCM connectivity check."
    );

    // API opt-in still works (server path)
    const apiTok = `demo_api_${Date.now().toString(36)}`;
    const apiRes = await fetch(`${BASE}/api/policies/reminders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieHeader },
      body: JSON.stringify({ push: true, fcmToken: apiTok }),
    });
    if (apiRes.ok) pass("api-optin-fallback");
    else fail("api-optin-fallback", String(apiRes.status));

    // Admin FCM connectivity: dry-run-ish with invalid token → expect known error code
    try {
      await messaging.send({
        token: "invalid-demo-token-for-connectivity-check",
        notification: { title: "x", body: "y" },
      });
      fail("admin-fcm-connectivity", "unexpected success");
    } catch (e) {
      const code = String((e as { code?: string })?.code || e);
      if (/messaging\//i.test(code) || /invalid|registration/i.test(code)) {
        pass("admin-fcm-connectivity", "Admin SDK messaging reachable");
      } else {
        fail(
          "admin-fcm-connectivity",
          code.replace(/[A-Za-z0-9_-]{80,}/g, "[redacted]").slice(0, 120)
        );
      }
    }
  }

  pass("demo-only-guard", DEMO_HEALTH_ID);
  await browser.close();
  console.log("\nDONE");
}

main().catch((e) => {
  console.error("FATAL", e instanceof Error ? e.message : e);
  process.exit(1);
});
