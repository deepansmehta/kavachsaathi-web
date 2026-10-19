import { FieldValue, type Firestore } from "firebase-admin/firestore";

export const ACTIVATION_LOCK_MAX_FAILS = 5;
export const ACTIVATION_LOCK_MS = 24 * 60 * 60 * 1000;
export const ACTIVATION_LOCK_HELPLINE = "+91 72730 00075";
export const ACTIVATION_LOCK_MESSAGE = `Too many attempts — call helpline ${ACTIVATION_LOCK_HELPLINE}`;

export type ActivationLockState = {
  locked: boolean;
  failCount: number;
  lockedUntilMs: number | null;
  retryAfterSec: number | null;
};

function toMs(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const t = Date.parse(value);
    return Number.isFinite(t) ? t : null;
  }
  if (
    typeof value === "object" &&
    value !== null &&
    "toMillis" in value &&
    typeof (value as { toMillis: () => number }).toMillis === "function"
  ) {
    return (value as { toMillis: () => number }).toMillis();
  }
  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate: () => Date }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().getTime();
  }
  return null;
}

export function readActivationLock(
  data: FirebaseFirestore.DocumentData | undefined | null,
  nowMs = Date.now()
): ActivationLockState {
  const failCount = Math.max(
    0,
    Number(data?.activationFailCount || 0) || 0
  );
  const lockedUntilMs = toMs(data?.activationLockedUntil);
  if (lockedUntilMs != null && lockedUntilMs > nowMs) {
    return {
      locked: true,
      failCount,
      lockedUntilMs,
      retryAfterSec: Math.max(1, Math.ceil((lockedUntilMs - nowMs) / 1000)),
    };
  }
  return {
    locked: false,
    failCount,
    lockedUntilMs: lockedUntilMs && lockedUntilMs <= nowMs ? null : lockedUntilMs,
    retryAfterSec: null,
  };
}

/** Log lock events with card ID only — never codes. */
async function logActivationLockEvent(
  db: Firestore,
  opts: {
    health_id: string;
    docId: string;
    event: "locked" | "unlocked" | "fail";
    failCount?: number;
    byEmail?: string | null;
  }
): Promise<void> {
  try {
    await db.collection("activation_lock_events").add({
      health_id: opts.health_id,
      docId: opts.docId,
      event: opts.event,
      failCount: opts.failCount ?? null,
      byEmail: opts.byEmail ?? null,
      at: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error("activation_lock_log", opts.health_id, opts.event, err);
  }
  if (opts.event === "locked") {
    console.info("activation_lock", { health_id: opts.health_id, event: "locked" });
  }
}

/**
 * Record a wrong activation-code attempt. Locks the card for 24h after 5 fails.
 * Returns the post-update lock state.
 */
export async function recordActivationCodeFailure(
  db: Firestore,
  opts: { docId: string; health_id: string }
): Promise<ActivationLockState> {
  const ref = db.collection("cards").doc(opts.docId);
  const now = Date.now();

  const state = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      return {
        locked: false,
        failCount: 0,
        lockedUntilMs: null,
        retryAfterSec: null,
      } satisfies ActivationLockState;
    }
    const data = snap.data()!;
    const current = readActivationLock(data, now);
    if (current.locked) return current;

    const failCount = current.failCount + 1;
    if (failCount >= ACTIVATION_LOCK_MAX_FAILS) {
      const lockedUntilMs = now + ACTIVATION_LOCK_MS;
      tx.update(ref, {
        activationFailCount: failCount,
        activationLockedUntil: new Date(lockedUntilMs).toISOString(),
      });
      return {
        locked: true,
        failCount,
        lockedUntilMs,
        retryAfterSec: Math.ceil(ACTIVATION_LOCK_MS / 1000),
      } satisfies ActivationLockState;
    }

    tx.update(ref, {
      activationFailCount: failCount,
      activationLockedUntil: FieldValue.delete(),
    });
    return {
      locked: false,
      failCount,
      lockedUntilMs: null,
      retryAfterSec: null,
    } satisfies ActivationLockState;
  });

  if (state.locked && state.failCount >= ACTIVATION_LOCK_MAX_FAILS) {
    await logActivationLockEvent(db, {
      health_id: opts.health_id,
      docId: opts.docId,
      event: "locked",
      failCount: state.failCount,
    });
  } else {
    await logActivationLockEvent(db, {
      health_id: opts.health_id,
      docId: opts.docId,
      event: "fail",
      failCount: state.failCount,
    });
  }

  return state;
}

/** Clear fail counter after a successful code match. */
export async function clearActivationFailures(
  db: Firestore,
  docId: string
): Promise<void> {
  await db
    .collection("cards")
    .doc(docId)
    .set(
      {
        activationFailCount: 0,
        activationLockedUntil: FieldValue.delete(),
      },
      { merge: true }
    );
}

/** Admin unlock — clears lock + fail counter. */
export async function unlockActivationForCard(
  db: Firestore,
  opts: { docId: string; health_id: string; byEmail: string }
): Promise<void> {
  await db
    .collection("cards")
    .doc(opts.docId)
    .set(
      {
        activationFailCount: 0,
        activationLockedUntil: FieldValue.delete(),
        activationUnlockedAt: new Date().toISOString(),
        activationUnlockedBy: opts.byEmail,
      },
      { merge: true }
    );
  await logActivationLockEvent(db, {
    health_id: opts.health_id,
    docId: opts.docId,
    event: "unlocked",
    byEmail: opts.byEmail,
  });
  await db.collection("admin_logs").add({
    action: "unlock_activation",
    byEmail: opts.byEmail,
    health_id: opts.health_id,
    at: new Date().toISOString(),
  });
}
