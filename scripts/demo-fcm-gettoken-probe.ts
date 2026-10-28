/**
 * DEMO-ONLY: diagnose FCM getToken + send test notification.
 * Never prints tokens/VAPID.
 *
 *   VAPID=... npx --yes tsx scripts/demo-fcm-gettoken-probe.ts
 */
import * as fs from "fs";
import { chromium } from "playwright";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { DEMO_HEALTH_ID } from "./demoConstants";

const BASE = "https://kavachsaathi.in";
const PIN = "482913";
const VAPID = (
  process.env.VAPID ||
  process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ||
  ""
).trim();

function errText(e: unknown): string {
  const err = e as { name?: string; code?: string | number; message?: string };
  const parts = [
    err?.name,
    err?.code != null ? String(err.code) : "",
    err?.message,
  ].filter(Boolean);
  return parts.join(" | ").slice(0, 280) || String(e).slice(0, 280);
}

async function main() {
  if (!VAPID || VAPID.length < 80) {
    console.log("FAIL vapid-missing-or-short len=" + VAPID.length);
    process.exit(1);
  }
  console.log("vapid_len", VAPID.length);

  const sa = JSON.parse(fs.readFileSync("service-account.json", "utf8"));
  if (!getApps().length) {
    initializeApp({ credential: cert(sa), projectId: sa.project_id });
  }
  const messaging = getMessaging();

  const login = await fetch(`${BASE}/api/profile/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ health_id: DEMO_HEALTH_ID, pin: PIN }),
  });
  const setCookie = login.headers.getSetCookie?.() || [];
  const cookie = setCookie.map((c) => c.split(";")[0]).join("; ");
  if (!login.ok) throw new Error("login " + login.status);
  console.log("PASS login");

  let browser;
  try {
    browser = await chromium.launch({
      headless: false,
      channel: "chrome",
      args: ["--disable-blink-features=AutomationControlled"],
    });
  } catch {
    browser = await chromium.launch({
      headless: false,
      channel: "chromium",
    });
  }
  const context = await browser.newContext({
    serviceWorkers: "allow",
    ignoreHTTPSErrors: true,
    permissions: ["notifications"],
  });
  for (const part of cookie.split("; ")) {
    const [n, ...r] = part.split("=");
    if (!n) continue;
    await context.addCookies([
      {
        name: n,
        value: r.join("="),
        domain: "kavachsaathi.in",
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "Lax",
      },
    ]);
  }
  const page = await context.newPage();
  await page.goto(
    `${BASE}/my-profile?health_id=${DEMO_HEALTH_ID}&section=policies`,
    { waitUntil: "domcontentloaded", timeout: 60000 }
  );
  // Grant after navigation (Playwright + Chrome PushManager quirk)
  await context.grantPermissions(["notifications"], { origin: BASE });
  try {
    const cdp = await context.newCDPSession(page);
    await cdp.send("Browser.grantPermissions", {
      origin: BASE,
      permissions: ["notifications"],
    });
  } catch {
    /* CDP optional */
  }
  await page.waitForTimeout(1500);
  // Explicit in-page permission + user gesture before PushManager.subscribe
  await page.mouse.click(40, 40).catch(() => undefined);
  await page.evaluate(async () => {
    if (typeof Notification !== "undefined" && Notification.permission !== "granted") {
      await Notification.requestPermission();
    }
  });

  // Stringify body so tsx/esbuild __name helpers are not injected into the page
  const result = await page.evaluate(
    // eslint-disable-next-line no-new-func
    new Function(
      "vapid",
      `return (async () => {
    const out = {
      perm: Notification.permission,
      vapidLen: (vapid || "").length,
    };
    function describe(e) {
      var err = e || {};
      return [err.name, err.code, err.message]
        .filter(function (x) { return x != null && x !== ""; })
        .join(" | ")
        .slice(0, 280);
    }
    try {
      var regsBefore = await navigator.serviceWorker.getRegistrations();
      out.regsBefore = regsBefore.map(function (r) {
        return {
          scope: r.scope,
          script: (r.active && r.active.scriptURL) ||
            (r.installing && r.installing.scriptURL) || "",
          active: !!r.active,
        };
      });

      var reg = await navigator.serviceWorker.register(
        "/firebase-messaging-sw.js",
        { scope: "/firebase-cloud-messaging-push-scope" }
      );
      out.scope = reg.scope;
      if (!reg.active) {
        var worker = reg.installing || reg.waiting;
        if (worker) {
          await new Promise(function (resolve) {
            var t = setTimeout(resolve, 12000);
            worker.addEventListener("statechange", function () {
              if (worker.state === "activated") {
                clearTimeout(t);
                resolve();
              }
            });
          });
        }
      }
      out.active = !!reg.active;
      out.script = (reg.active && reg.active.scriptURL) || "";

      try {
        var existing = await reg.pushManager.getSubscription();
        out.hadSub = !!existing;
        if (!existing) {
          var pad = "=".repeat((4 - (vapid.length % 4)) % 4);
          var b64 = (vapid + pad).replace(/-/g, "+").replace(/_/g, "/");
          var raw = atob(b64);
          var key = new Uint8Array(raw.length);
          for (var i = 0; i < raw.length; i++) key[i] = raw.charCodeAt(i);
          var sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: key,
          });
          out.pushSubOk = !!(sub && sub.endpoint);
          try { await sub.unsubscribe(); } catch (u) {}
        } else {
          out.pushSubOk = true;
        }
      } catch (e) {
        out.pushSubErr = describe(e);
      }

      await new Promise(function (resolve, reject) {
        var s1 = document.createElement("script");
        s1.src = "https://www.gstatic.com/firebasejs/12.0.0/firebase-app-compat.js";
        s1.onload = function () { resolve(); };
        s1.onerror = function () { reject(new Error("app-compat load fail")); };
        document.head.appendChild(s1);
      });
      await new Promise(function (resolve, reject) {
        var s2 = document.createElement("script");
        s2.src = "https://www.gstatic.com/firebasejs/12.0.0/firebase-messaging-compat.js";
        s2.onload = function () { resolve(); };
        s2.onerror = function () { reject(new Error("messaging-compat load fail")); };
        document.head.appendChild(s2);
      });

      var firebase = window.firebase;
      if (!firebase.apps.length) {
        firebase.initializeApp({
          apiKey: "AIzaSyA-IIntsGg8S6BsDPFcvF5oTe8Nr-mvdNc",
          authDomain: "kavachsaathi.firebaseapp.com",
          projectId: "kavachsaathi",
          storageBucket: "kavachsaathi.firebasestorage.app",
          messagingSenderId: "375452318042",
          appId: "1:375452318042:web:53af816e6cb03b0a599b63",
        });
      }
      var msg = firebase.messaging();
      try {
        var token = await msg.getToken({
          vapidKey: vapid,
          serviceWorkerRegistration: reg,
        });
        out.tokenLen = token ? String(token).length : 0;
        out.ok = !!token;
        window.__demoFcmToken = token || null;
      } catch (e) {
        out.getTokenErr = describe(e);
      }
    } catch (e) {
      out.err = describe(e);
    }
    return out;
  })()`
    ) as (vapid: string) => Promise<Record<string, unknown>>,
    VAPID
  );

  console.log("probe", JSON.stringify(result));

  const token = (await page.evaluate(
    "window.__demoFcmToken || null"
  )) as string | null;

  if (token && String(token).length > 80) {
    const save = await fetch(`${BASE}/api/policies/reminders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ push: true, fcmToken: token }),
    });
    console.log(save.ok ? "PASS save-token" : "FAIL save-token " + save.status);
    try {
      const id = await messaging.send({
        token: String(token),
        notification: {
          title: "KavachSaathi test",
          body: "DEMO Policy Saathi push OK",
        },
        data: { type: "policy_reminder_test", health_id: DEMO_HEALTH_ID },
        webpush: {
          fcmOptions: {
            link: `${BASE}/my-profile?health_id=${DEMO_HEALTH_ID}`,
          },
        },
      });
      console.log("PASS test-notification id_len=" + String(id).length);
    } catch (e: unknown) {
      console.log(
        "FAIL test-notification",
        errText(e)
          .replace(/[A-Za-z0-9_-]{80,}/g, "[redacted]")
          .slice(0, 180)
      );
      process.exitCode = 1;
    }
  } else {
    console.log("FAIL getToken-probe");
    process.exitCode = 1;
  }
  await browser.close();
}

main().catch((e) => {
  console.error("FATAL", e instanceof Error ? e.message : e);
  process.exit(1);
});
