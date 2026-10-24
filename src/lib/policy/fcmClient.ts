/**
 * FCM web-push client helper for Policy Saathi renewal reminders.
 * Uses the existing `firebase` package only (no paid deps). Fails silently
 * (returns null) whenever push isn't supported / configured — callers must
 * treat null as "skip quietly", never as an error to surface to the user.
 */

/** Ask the browser for Notification permission. Resolves false if unsupported / denied. */
export async function requestNotificationPermission(): Promise<boolean> {
  try {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return false;
    }
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied") return false;
    const result = await Notification.requestPermission();
    return result === "granted";
  } catch {
    return false;
  }
}

/**
 * Get an FCM registration token for this browser, or null if messaging is
 * unsupported, the VAPID key is missing, or anything else goes wrong.
 * Never throws.
 */
export async function getPolicyFcmToken(): Promise<string | null> {
  try {
    if (typeof window === "undefined") return null;
    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
    if (!vapidKey) return null;
    if (!("serviceWorker" in navigator)) return null;

    const { isSupported, getMessaging, getToken } = await import(
      "firebase/messaging"
    );
    const supported = await isSupported().catch(() => false);
    if (!supported) return null;

    const granted = await requestNotificationPermission();
    if (!granted) return null;

    const appMod = await import("@/lib/firebase");
    const messaging = getMessaging(appMod.default);

    let registration: ServiceWorkerRegistration | undefined;
    try {
      registration =
        (await navigator.serviceWorker.getRegistration()) || undefined;
    } catch {
      registration = undefined;
    }

    const token = await getToken(messaging, {
      vapidKey,
      ...(registration ? { serviceWorkerRegistration: registration } : {}),
    }).catch(() => null);

    return token || null;
  } catch {
    return null;
  }
}

/** Convenience: opt-in flow — permission + token + save via reminders API. Never throws. */
export async function enablePolicyPush(): Promise<{
  enabled: boolean;
  token: string | null;
}> {
  const token = await getPolicyFcmToken();
  if (!token) return { enabled: false, token: null };
  try {
    const res = await fetch("/api/policies/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ push: true, fcmToken: token }),
    });
    if (!res.ok) return { enabled: false, token: null };
    return { enabled: true, token };
  } catch {
    return { enabled: false, token: null };
  }
}
