/**
 * Netlify Scheduled Function — daily cleanup of abandoned pending/ uploads (>24h).
 * Deletes ONLY Storage objects under pending/ older than max age.
 * Never touches profiles/, accessLogs, cards, or KVS-2026-* paths.
 * CLEANUP_DRY_RUN=true → log counts only, no deletes.
 */
import { initializeApp, cert, getApps, type App } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";
import {
  DEFAULT_MAX_AGE_MS,
  PENDING_PREFIX,
  planPendingCleanup,
  type PendingFileMeta,
} from "../../src/lib/cleanupPending";

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
  const bucket =
    process.env.FIREBASE_STORAGE_BUCKET ||
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  return initializeApp({
    credential: cert(credentials as Parameters<typeof cert>[0]),
    projectId: credentials.project_id,
    ...(bucket ? { storageBucket: bucket } : {}),
  });
}

function isDryRun(): boolean {
  const v = String(process.env.CLEANUP_DRY_RUN || "")
    .trim()
    .toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export const config = {
  schedule: "@daily",
};

export default async function handler() {
  try {
    init();
    const bucketName =
      process.env.FIREBASE_STORAGE_BUCKET ||
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    if (!bucketName) {
      return new Response(JSON.stringify({ error: "no bucket" }), { status: 503 });
    }
    const bucket = getStorage().bucket(bucketName);
    // Prefix scoped: pending/ only — never list profiles/
    const [files] = await bucket.getFiles({ prefix: PENDING_PREFIX });
    const metas: PendingFileMeta[] = files.map((f) => ({
      name: f.name,
      updated: f.metadata?.updated || null,
      timeCreated: f.metadata?.timeCreated || null,
    }));
    const dryRun = isDryRun();
    const maxAgeMs = Number(process.env.CLEANUP_MAX_AGE_MS || DEFAULT_MAX_AGE_MS);
    const plan = planPendingCleanup(metas, { maxAgeMs, dryRun });

    let deleted = 0;
    if (!dryRun) {
      for (const s of plan.selected) {
        await bucket.file(s.path).delete({ ignoreNotFound: true }).catch(() => {});
        deleted += 1;
      }
    }

    console.log(
      `cleanup-pending scanned=${plan.scanned} selected=${plan.selected.length} deleted=${deleted} skipped=${plan.skipped} dryRun=${dryRun}`
    );
    return new Response(
      JSON.stringify({
        ok: true,
        scanned: plan.scanned,
        selected: plan.selected.length,
        deleted,
        skipped: plan.skipped,
        dryRun,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("cleanup-pending failed");
    return new Response(
      JSON.stringify({
        ok: false,
        error: e instanceof Error ? e.message : "failed",
      }),
      { status: 500 }
    );
  }
}
