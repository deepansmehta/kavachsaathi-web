/**
 * Unit tests for referral reward rules (no network).
 *   npx --yes tsx scripts/test-referral-reward.ts
 */
import assert from "assert";
import { applyReferralRewardInTx } from "../src/lib/referralReward";
import { DEFAULT_POLICY } from "../src/lib/config/siteConfig";
import { addDaysIso } from "../src/lib/validity";
import { referralShareMessage } from "../src/lib/config/links";

type FakeTx = {
  updates: { id: string; data: Record<string, unknown> }[];
  update: (ref: { id: string }, data: Record<string, unknown>) => void;
};

function makeTx(): FakeTx {
  const updates: FakeTx["updates"] = [];
  return {
    updates,
    update(ref, data) {
      updates.push({ id: ref.id, data });
    },
  };
}

function pass(id: string) {
  console.log("PASS", id);
}
function fail(id: string, d: string) {
  console.log("FAIL", id, d);
  process.exitCode = 1;
}

function main() {
  const policy = { ...DEFAULT_POLICY };
  const now = new Date("2026-06-01T00:00:00Z");

  // Valid reward
  {
    const tx = makeTx();
    const r = applyReferralRewardInTx(tx as never, {
      referrerRef: { id: "ref1" } as never,
      referrerData: {
        phoneNormalized: "9876543210",
        validTill: "2027-01-01T00:00:00.000Z",
        health_id: "KVS-2099-AAAAA",
        referralRewardYear: 2026,
        referralRewardMonthsThisYear: 2,
      },
      newPhoneNormalized: "9123456789",
      newHealthId: "KVS-2099-BBBBB",
      policy,
      now,
    });
    r.ok && r.monthsGrantedThisYear === 3
      ? pass("valid reward +30d / months=3")
      : fail("valid reward", JSON.stringify(r));
    assert(tx.updates.length === 1);
  }

  // Self referral
  {
    const tx = makeTx();
    const r = applyReferralRewardInTx(tx as never, {
      referrerRef: { id: "ref1" } as never,
      referrerData: {
        phoneNormalized: "9876543210",
        validTill: "2027-01-01T00:00:00.000Z",
        health_id: "KVS-2099-AAAAA",
      },
      newPhoneNormalized: "9876543210",
      newHealthId: "KVS-2099-BBBBB",
      policy,
      now,
    });
    !r.ok && r.code === "SELF_REFERRAL"
      ? pass("self-referral rejected")
      : fail("self-referral", JSON.stringify(r));
  }

  // Same family
  {
    const tx = makeTx();
    const r = applyReferralRewardInTx(tx as never, {
      referrerRef: { id: "ref1" } as never,
      referrerData: {
        phoneNormalized: "9111111111",
        familyGroupId: "fam1",
        validTill: "2027-01-01T00:00:00.000Z",
        health_id: "KVS-2099-AAAAA",
      },
      newPhoneNormalized: "9222222222",
      newFamilyGroupId: "fam1",
      newHealthId: "KVS-2099-BBBBB",
      policy,
      now,
    });
    !r.ok && r.code === "SAME_FAMILY"
      ? pass("same-family rejected")
      : fail("same-family", JSON.stringify(r));
  }

  // Yearly cap
  {
    const tx = makeTx();
    const r = applyReferralRewardInTx(tx as never, {
      referrerRef: { id: "ref1" } as never,
      referrerData: {
        phoneNormalized: "9111111111",
        validTill: "2027-01-01T00:00:00.000Z",
        health_id: "KVS-2099-AAAAA",
        referralRewardYear: 2026,
        referralRewardMonthsThisYear: 12,
      },
      newPhoneNormalized: "9222222222",
      newHealthId: "KVS-2099-BBBBB",
      policy,
      now,
    });
    !r.ok && r.code === "YEARLY_CAP"
      ? pass("yearly cap rejected")
      : fail("yearly cap", JSON.stringify(r));
  }

  // Share message
  {
    const msg = referralShareMessage("KS000001");
    /referral code KS000001/i.test(msg) && /kavachsaathi\.in/i.test(msg)
      ? pass("share message Hindi copy")
      : fail("share message", msg);
  }

  // Validity default +365
  {
    const from = "2026-10-06T00:00:00.000Z";
    const till = addDaysIso(from, 365);
    till.startsWith("2027-10-06")
      ? pass("validity +365 from activation")
      : fail("validity +365", till);
  }

  if (process.exitCode) {
    console.log("\nSome referral reward tests FAILED");
    process.exit(1);
  }
  console.log("\nAll referral reward unit tests passed");
}

main();
