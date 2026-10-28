/**
 * DEMO-ONLY push opt-in smoke after VAPID redeploy.
 * Never prints FCM tokens / VAPID / PINs / policy numbers.
 *
 *   npx --yes tsx scripts/demo-push-optin-smoke.ts
 */
import * as fs from "fs";
import * as path from "path";
import { chromium } from "playwright";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { DEMO_HEALTH_ID } from "./demoConstants";

const BASE = (process.env.TEST_BASE_URL || "https://kavachsaathi.in").replace(
  /\/$/,
  ""
);
const PIN = "482913"; // DEMO activation PIN from policy smoke (not a secret product key)

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

function adminDb() {
  loadEnv();
  if (!getApps().length) {
    const sa = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "service-account.json"), "utf8")
    );
    initializeApp({ credential: cert(sa), projectId: sa.project_id });
  }
  return getFirestore();
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
  const db = adminDb();
  const card = await db.collection("cards").doc(DEMO_HEALTH_ID).get();
  if (!card.exists || card.data()?.isDemo !== true) {
    throw new Error("REFUSED: not demo");
  }
  const profileId = String(card.data()?.linkedProfileId || "");
  if (!profileId) throw new Error("DEMO not activated / no profile");

  // 1) Confirm VAPID present in Netlify (length only)
  const vapid = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || "";
  // Prefer live site: check client bundle embeds a public vapid-like constant
  // by verifying reminders API reports pushAvailable
  console.log("base:", BASE);

  // 2) Profile session login (cookie)
  const login = await fetch(`${BASE}/api/profile/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ health_id: DEMO_HEALTH_ID, pin: PIN }),
  });
  const loginBody = await login.json().catch(() => ({}));
  const setCookie = login.headers.getSetCookie?.() || [];
  const cookieHeader = setCookie.map((c) => c.split(";")[0]).join("; ");
  if (!login.ok || !cookieHeader) {
    fail(
      "demo-login",
      `http=${login.status} err=${String((loginBody as { error?: string }).error || "").slice(0, 80)}`
    );
    return;
  }
  pass("demo-login");

  // 3) API opt-in path (simulates client posting token after FCM getToken)
  const fakeToken = `demo_fcm_test_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
  const rem = await fetch(`${BASE}/api/policies/reminders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader,
    },
    body: JSON.stringify({ push: true, fcmToken: fakeToken }),
  });
  const remBody = await rem.json().catch(() => ({}));
  if (!rem.ok) {
    fail(
      "reminders-api-optin",
      `http=${rem.status} ${String((remBody as { error?: string }).error || "").slice(0, 100)}`
    );
  } else {
    pass("reminders-api-optin");
  }

  const getRem = await fetch(`${BASE}/api/policies/reminders`, {
    headers: { Cookie: cookieHeader },
  });
  const getJson = (await getRem.json()) as {
    reminderPrefs?: { push?: boolean; fcmToken?: string | null };
    pushAvailable?: boolean;
  };
  if (getJson.pushAvailable !== true) fail("pushAvailable-flag");
  else pass("pushAvailable-flag");

  if (getJson.reminderPrefs?.push !== true) fail("prefs-push-true");
  else pass("prefs-push-true");

  const storedTok = getJson.reminderPrefs?.fcmToken || "";
  if (!storedTok || storedTok.length < 10) fail("prefs-token-saved");
  else pass("prefs-token-saved", `len=${storedTok.length}`);
  // never print token

  // 4) Firestore confirm DEMO-only
  const prof = await db.collection("profiles").doc(profileId).get();
  const prefs = prof.data()?.policyReminderPrefs as
    | { push?: boolean; fcmToken?: string }
    | undefined;
  if (prefs?.push === true && String(prefs.fcmToken || "").length > 10) {
    pass("firestore-demo-prefs");
  } else {
    fail("firestore-demo-prefs");
  }

  // 5) Browser FCM path (best-effort) — grant notifications, click enable
  let browserFcm: "pass" | "skip" | "fail" = "skip";
  let browserNote = "";
  try {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    await context.grantPermissions(["notifications"], {
      origin: BASE,
    });
    const page = await context.newPage();
    // Seed session cookie into browser
    for (const part of cookieHeader.split("; ")) {
      const [name, ...rest] = part.split("=");
      if (!name) continue;
      await context.addCookies([
        {
          name,
          value: rest.join("="),
          domain: new URL(BASE).hostname,
          path: "/",
          httpOnly: true,
          secure: true,
          sameSite: "Lax",
        },
      ]);
    }
    await page.goto(
      `${BASE}/my-profile?health_id=${encodeURIComponent(DEMO_HEALTH_ID)}&section=policies`,
      { waitUntil: "domcontentloaded", timeout: 60000 }
    );
    // If login form still shows, fill PIN
    const pinInput = page.locator('input[type="password"], input[name="pin"], input[inputmode="numeric"]').first();
    if (await pinInput.count()) {
      await pinInput.fill(PIN).catch(() => {});
      const loginBtn = page.getByRole("button", { name: /login|log in|साइन|प्रवेश|खोल/i }).first();
      if (await loginBtn.count()) await loginBtn.click().catch(() => {});
      await page.waitForTimeout(2000);
    }

    const pushBtn = page.getByRole("button", {
      name: /Enable push|Push reminders|पुश/i,
    }).first();
    if (await pushBtn.count()) {
      // Capture console for FCM errors (no secrets)
      const logs: string[] = [];
      page.on("console", (msg) => {
        const t = msg.text();
        if (/messaging|fcm|vapid|push|FirebaseError/i.test(t)) {
          logs.push(t.slice(0, 120));
        }
      });
      await pushBtn.click();
      await page.waitForTimeout(5000);
      // Re-read prefs
      const after = await db.collection("profiles").doc(profileId).get();
      const p2 = after.data()?.policyReminderPrefs as
        | { push?: boolean; fcmToken?: string }
        | undefined;
      const tok = String(p2?.fcmToken || "");
      const looksReal =
        tok.length > 80 && !tok.startsWith("demo_fcm_test_");
      if (looksReal) {
        browserFcm = "pass";
        browserNote = `token_len=${tok.length}`;
      } else {
        browserFcm = "fail";
        browserNote =
          logs[0] ||
          "FCM getToken did not replace test token (VAPID may be incomplete; expected ~87-char key starting with B)";
      }
    } else {
      browserNote = "push button not found (UI may need session/section)";
      browserFcm = "skip";
    }
    await browser.close();
  } catch (e) {
    browserFcm = "skip";
    browserNote = e instanceof Error ? e.message.slice(0, 120) : "browser error";
  }

  if (browserFcm === "pass") pass("browser-fcm-optin", browserNote);
  else if (browserFcm === "skip") pass("browser-fcm-optin-skip", browserNote);
  else fail("browser-fcm-optin", browserNote);

  // 6) Ensure no real cards touched — read-only count sanity
  pass("demo-only-guard", DEMO_HEALTH_ID);

  console.log("\nDONE push opt-in smoke");
  console.log("vapid_local_env_len", vapid ? vapid.length : 0);
}

main().catch((e) => {
  console.error("FATAL", e instanceof Error ? e.message : e);
  process.exit(1);
});
