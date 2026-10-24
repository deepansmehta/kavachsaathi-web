/**
 * Netlify Scheduled Function — daily Policy Saathi renewal reminders.
 * Scans profiles with policyReminderPrefs.push === true; for any policy whose
 * endDate is exactly 30, 7, or 1 day(s) away, sends an FCM push (if a token
 * is present). Silently skips errors per profile/policy so one bad record
 * never blocks the batch. NEVER logs policy numbers, PINs, or tokens.
 */
import { initializeApp, cert, getApps, type App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { parsePolicyDate, daysUntil } from "../../src/lib/policy/status";
import { POLICY_TYPE_LABELS } from "../../src/lib/policy/constants";

const REMINDER_DAYS = new Set([30, 7, 1]);

function init(): App {
  if (getApps().length) return getApps()[0];
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  let credentials: Record<string, string>;
  if (raw) {
    credentials = JSON.parse(raw);
  } else if (
    process.env.FIREBASE_ADMIN_PROJECT_ID &&
    process.env.FIREBASE_ADMIN_CLIENT_EMAIL &&
    process.env.FIREBASE_ADMIN_PRIVATE_KEY
  ) {
    credentials = {
      project_id: process.env.FIREBASE_ADMIN_PROJECT_ID,
      client_email: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      private_key: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, "\n"),
    };
  } else {
    throw new Error("Firebase Admin credentials missing");
  }
  return initializeApp({
    credential: cert(credentials as Parameters<typeof cert>[0]),
    projectId: credentials.project_id,
  });
}

type PolicyLike = {
  id?: string;
  type?: string;
  insurerName?: string;
  endDate?: string | null;
  showOnEmergencyScan?: boolean;
};

export const config = {
  schedule: "@daily",
};

export default async function handler() {
  try {
    init();
    const db = getFirestore();
    const messaging = getMessaging();

    const snap = await db
      .collection("profiles")
      .where("policyReminderPrefs.push", "==", true)
      .get();

    let scanned = 0;
    let matched = 0;
    let sent = 0;
    let skipped = 0;

    for (const doc of snap.docs) {
      scanned += 1;
      try {
        const data = doc.data();
        const fcmToken = String(
          (data.policyReminderPrefs as { fcmToken?: string } | undefined)
            ?.fcmToken || ""
        ).trim();
        if (!fcmToken) continue;

        const policies = Array.isArray(data.policies)
          ? (data.policies as PolicyLike[])
          : [];

        for (const policy of policies) {
          try {
            if (!policy || typeof policy !== "object") continue;
            if (policy.showOnEmergencyScan === false) continue;
            const end = parsePolicyDate(policy.endDate);
            if (!end) continue;
            const d = daysUntil(end);
            if (!REMINDER_DAYS.has(d)) continue;
            matched += 1;

            const labels =
              POLICY_TYPE_LABELS[(policy.type as keyof typeof POLICY_TYPE_LABELS) || "other"] ||
              POLICY_TYPE_LABELS.other;
            const insurer = String(policy.insurerName || "your insurer").trim();

            try {
              await messaging.send({
                token: fcmToken,
                notification: {
                  title: "KavachSaathi — Policy renewal reminder",
                  body: `Your ${labels.en} policy with ${insurer} renews in ${d} day${d === 1 ? "" : "s"}.`,
                },
                data: {
                  type: "policy_renewal",
                  days: String(d),
                },
              });
              sent += 1;
            } catch {
              // Invalid/expired token, messaging quota, etc. — skip silently.
              skipped += 1;
            }
          } catch {
            skipped += 1;
          }
        }
      } catch {
        skipped += 1;
      }
    }

    console.log(
      `policy-reminders scanned=${scanned} matched=${matched} sent=${sent} skipped=${skipped}`
    );
    return new Response(
      JSON.stringify({ ok: true, scanned, matched, sent, skipped }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("policy-reminders failed");
    return new Response(
      JSON.stringify({
        ok: false,
        error: e instanceof Error ? e.message : "failed",
      }),
      { status: 500 }
    );
  }
}
