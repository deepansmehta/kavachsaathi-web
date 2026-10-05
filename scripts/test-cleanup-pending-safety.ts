/**
 * Unit tests for pending cleanup planner — activated / real kits never selected.
 *   npx ts-node --skipProject --compiler-options '{"module":"commonjs","esModuleInterop":true}' \
 *     scripts/test-cleanup-pending-safety.ts
 */
import {
  isSafePendingPath,
  planPendingCleanup,
} from "../src/lib/cleanupPending";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const now = Date.now();
const old = new Date(now - 48 * 60 * 60 * 1000).toISOString();
const fresh = new Date(now - 1 * 60 * 60 * 1000).toISOString();

assert(isSafePendingPath("pending/KVS-2099-CLN01/x.jpg") === true, "pending ok");
assert(isSafePendingPath("profiles/KVS-DEMO-00001/photo.jpg") === false, "profiles blocked");
assert(isSafePendingPath("pending/../profiles/x") === false, "traversal blocked");
assert(isSafePendingPath("pending/KVS-2026-AAAAA/x.jpg") === false, "real kit path blocked");
assert(isSafePendingPath("accessLogs/foo") === false, "accessLogs blocked");

const plan = planPendingCleanup(
  [
    { name: "pending/KVS-2099-CLN01/old.jpg", updated: old },
    { name: "pending/KVS-2099-CLN01/new.jpg", updated: fresh },
    { name: "profiles/KVS-DEMO-00001/photo.jpg", updated: old },
    { name: "pending/KVS-2026-75QW6/leak.jpg", updated: old },
    { name: "profiles/KVS-2026-75QW6/id.jpg", updated: old },
  ],
  { now, dryRun: true }
);

assert(plan.selected.length === 1, `expected 1 selected, got ${plan.selected.length}`);
assert(
  plan.selected[0].path === "pending/KVS-2099-CLN01/old.jpg",
  "wrong selection"
);
assert(
  !plan.selected.some((s) => /profiles\//.test(s.path)),
  "must never select profiles/"
);
assert(
  !plan.selected.some((s) => /KVS-2026-/.test(s.path)),
  "must never select real kit paths"
);
assert(plan.dryRun === true, "dryRun flag");

const live = planPendingCleanup(
  [{ name: "pending/KVS-2099-X/old.txt", updated: old }],
  { now, dryRun: false }
);
assert(live.dryRun === false, "live mode");
assert(live.selected.length === 1, "live selects old pending");

console.log("cleanup-pending safety tests: PASS");
console.log(
  `selected=${plan.selected.length} skipped=${plan.skipped} dryRun=${plan.dryRun}`
);
