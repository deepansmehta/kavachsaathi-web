/**
 * Find & delete users/{uid} docs created by legacy /api/auth/activate
 * that point at real KVS-2026-* cards. Never touches the cards collection.
 *
 *   npx tsx scripts/cleanup-legacy-auth-users.ts --dry-run
 *   npx tsx scripts/cleanup-legacy-auth-users.ts --apply
 *
 * Prints counts only — no health_ids, phones, or uids.
 */
import * as fs from "fs";
import * as path from "path";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

const DRY = process.argv.includes("--dry-run");
const APPLY = process.argv.includes("--apply");

function loadAdmin() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m && !process.env[m[1].trim()]) {
        process.env[m[1].trim()] = m[2].trim();
      }
    }
  }
  if (!getApps().length) {
    const sa = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "service-account.json"), "utf8")
    );
    initializeApp({ credential: cert(sa), projectId: sa.project_id });
  }
  return getFirestore();
}

function isReal2026(hid: unknown): boolean {
  return /^KVS-2026-[A-Z0-9]+$/i.test(String(hid || ""));
}

async function main() {
  if (!DRY && !APPLY) {
    console.error("Use --dry-run or --apply");
    process.exit(1);
  }
  const db = loadAdmin();
  const auth = getAuth();

  const usersSnap = await db.collection("users").get();
  const legacyRealDocs: FirebaseFirestore.QueryDocumentSnapshot[] = [];
  let usersDemo = 0;
  let users2099 = 0;
  let usersOther = 0;

  for (const d of usersSnap.docs) {
    const hid = d.data().health_id;
    if (isReal2026(hid)) legacyRealDocs.push(d);
    else if (/^KVS-DEMO-/i.test(String(hid || ""))) usersDemo += 1;
    else if (/^KVS-2099-/i.test(String(hid || ""))) users2099 += 1;
    else usersOther += 1;
  }

  // Auth accounts that still exist for those legacy user doc ids
  let authExists = 0;
  for (const d of legacyRealDocs) {
    try {
      await auth.getUser(d.id);
      authExists += 1;
    } catch {
      /* missing */
    }
  }

  console.log(DRY ? "DRY-RUN" : "APPLY");
  console.log(`users_total=${usersSnap.size}`);
  console.log(`users_real_KVS_2026=${legacyRealDocs.length}`);
  console.log(`users_demo=${usersDemo}`);
  console.log(`users_2099=${users2099}`);
  console.log(`users_other=${usersOther}`);
  console.log(`auth_users_for_those_docs=${authExists}`);
  console.log(`cards_will_be_touched=0`);

  if (DRY) return;

  let deletedUsers = 0;
  let deletedAuth = 0;
  for (const d of legacyRealDocs) {
    try {
      await auth.deleteUser(d.id);
      deletedAuth += 1;
    } catch {
      /* Auth may already be gone */
    }
    await d.ref.delete();
    deletedUsers += 1;
  }

  console.log(`deleted_users_docs=${deletedUsers}`);
  console.log(`deleted_auth_users=${deletedAuth}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
