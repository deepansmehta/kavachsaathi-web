/**
 * Turn ON selected feature flags in Firestore config/features.
 * Always snapshot first via scripts/snapshot-features.ts.
 *
 *   npx --yes tsx scripts/enable-features.ts --phase2
 *   npx --yes tsx scripts/enable-features.ts --keys cashlessTimer,recordsVault
 *   npx --yes tsx scripts/enable-features.ts --off regionalLang
 */
import { getAdminDb } from "../src/lib/firebase-admin";
import {
  FEATURE_KEYS,
  type FeatureKey,
} from "../src/lib/features/flags";

const PHASE2_3: FeatureKey[] = [
  "cashlessTimer",
  "recordsVault",
  "claimFormPrefill",
  "familyPlan",
  "abhaLink",
  "hospitalPortal",
  "orgDashboard",
  "nfcInfo",
  "regionalLang",
  "donorDirective",
];

const PACK2: FeatureKey[] = [
  "coverageSnapshot",
  "dischargeChecklist",
  "documentPack",
  "billRequestLetter",
  "claimDeadline",
  "attendantPass",
  "doctorSummary",
  "followUpPlanner",
  "schemeGuide",
  "needBlood",
  "janAushadhi",
  "disclosureVault",
];

const PACK3: FeatureKey[] = [
  "cardValidity",
  "lostCard",
  "dataExport",
  "adminAnalytics",
  "vehicleSticker",
  "referral",
  "feedback",
  "elderlyMode",
  "offlineEmergency",
];

const PACK4: FeatureKey[] = [
  "pwaApp",
  "autoSummary",
  "fhirExport",
  "scanRegister",
];

async function main() {
  const args = process.argv.slice(2);
  const off = args.includes("--off");
  let keys: FeatureKey[] = [];
  if (args.includes("--phase2") || args.includes("--phase2-3")) {
    keys = [...PHASE2_3];
  }
  if (args.includes("--pack2")) {
    keys = [...keys, ...PACK2];
  }
  if (args.includes("--pack3")) {
    keys = [...keys, ...PACK3];
  }
  if (args.includes("--pack4")) {
    keys = [...keys, ...PACK4];
  }
  const ki = args.indexOf("--keys");
  if (ki >= 0) {
    keys = String(args[ki + 1] || "")
      .split(",")
      .map((s) => s.trim())
      .filter((k): k is FeatureKey =>
        (FEATURE_KEYS as readonly string[]).includes(k)
      );
  }
  const skipIdx = args.indexOf("--skip");
  const skip = new Set(
    skipIdx >= 0
      ? String(args[skipIdx + 1] || "").split(",").map((s) => s.trim())
      : []
  );
  keys = keys.filter((k) => !skip.has(k));
  if (!keys.length) {
    console.error(
      "Usage: --phase2 | --pack2 | --pack3 | --pack4 | --keys a,b [--skip x] [--off]"
    );
    process.exit(1);
  }

  const db = getAdminDb();
  const ref = db.collection("config").doc("features");
  const patch: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
    updatedBy: "enable-features-script",
  };
  const value = !off;
  for (const k of keys) patch[k] = value;
  await ref.set(patch, { merge: true });
  const after = await ref.get();
  console.log(off ? "OFF" : "ON", keys.join(", "));
  console.log(JSON.stringify(after.data(), null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
