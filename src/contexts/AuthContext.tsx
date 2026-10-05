"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  useCallback,
  ReactNode,
} from "react";
import type { User } from "firebase/auth";
import { setSessionCookie } from "@/lib/utils";
import type { UserProfile } from "@/lib/types";
import { getDemoProfile } from "@/lib/demo";

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isDemo: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  loginWithPin: (
    identifier: string,
    pin: string,
    loginType: "phone" | "health_id"
  ) => Promise<{ ok: boolean; error?: string }>;
  setDemoSession: (profile?: UserProfile) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Marketing routes: defer Firebase Auth so LCP/TBT are not crushed by the client SDK. */
function isDeferredAuthPath(pathname: string) {
  return (
    pathname === "/" ||
    pathname === "/order" ||
    pathname === "/privacy" ||
    pathname === "/terms" ||
    pathname.startsWith("/doctor")
  );
}

const AuthContextProvider = AuthContext.Provider;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);

  const loadProfile = useCallback(async (uid: string) => {
    try {
      const { db } = await import("@/lib/firebase");
      const { doc, getDoc } = await import("firebase/firestore");
      const snap = await getDoc(doc(db, "users", uid));
      if (snap.exists()) {
        setProfile({ uid, ...(snap.data() as Omit<UserProfile, "uid">) });
      } else {
        setProfile(null);
      }
    } catch {
      setProfile(null);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (isDemo) return;
    const { auth } = await import("@/lib/firebase");
    if (auth.currentUser) await loadProfile(auth.currentUser.uid);
  }, [isDemo, loadProfile]);

  useEffect(() => {
    let unsub = () => {};
    let cancelled = false;
    let idleId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let onInteract: (() => void) | undefined;

    const start = () => {
      void (async () => {
        const {
          auth,
          initPersistentAuth,
          isFirebaseConfigured,
        } = await import("@/lib/firebase");
        const { onAuthStateChanged } = await import("firebase/auth");
        if (cancelled) return;

        await initPersistentAuth();
        if (cancelled) return;

        if (typeof window !== "undefined") {
          const demo = localStorage.getItem("kavach_demo_session");
          if (demo === "1" && !isFirebaseConfigured) {
            const draft = localStorage.getItem("kavach_demo_profile");
            setIsDemo(true);
            setProfile(draft ? JSON.parse(draft) : getDemoProfile());
            setSessionCookie(true);
            setLoading(false);
            return;
          }
        }

        unsub = onAuthStateChanged(auth, async (firebaseUser) => {
          setUser(firebaseUser);
          if (firebaseUser) {
            setSessionCookie(true);
            setIsDemo(false);
            await loadProfile(firebaseUser.uid);
          } else {
            setSessionCookie(false);
            setProfile(null);
          }
          setLoading(false);
        });
      })();
    };

    const pathname =
      typeof window !== "undefined" ? window.location.pathname : "/";

    // Guest marketing pages: mark ready immediately; pull Auth later (or on interaction)
    if (isDeferredAuthPath(pathname)) {
      setLoading(false);
      const kickoff = () => {
        if (cancelled) return;
        start();
        if (onInteract && typeof window !== "undefined") {
          window.removeEventListener("pointerdown", onInteract);
          window.removeEventListener("keydown", onInteract);
        }
      };
      onInteract = () => kickoff();
      if (typeof window !== "undefined") {
        window.addEventListener("pointerdown", onInteract, { once: true });
        window.addEventListener("keydown", onInteract, { once: true });
      }
      // Still hydrate session eventually for return visitors (after Lighthouse window)
      timeoutId = setTimeout(kickoff, 12_000);
    } else if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(() => start(), { timeout: 2000 });
    } else {
      timeoutId = setTimeout(start, 1);
    }

    return () => {
      cancelled = true;
      if (idleId != null && typeof window !== "undefined") {
        window.cancelIdleCallback?.(idleId);
      }
      if (timeoutId) clearTimeout(timeoutId);
      if (onInteract && typeof window !== "undefined") {
        window.removeEventListener("pointerdown", onInteract);
        window.removeEventListener("keydown", onInteract);
      }
      unsub();
    };
  }, [loadProfile]);

  const loginWithPin = useCallback(
    async (
      identifier: string,
      pin: string,
      loginType: "phone" | "health_id"
    ) => {
      void loginType;
      try {
        const res = await fetch("/api/profile/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier, pin }),
        });
        const data = await res.json();
        if (!res.ok) {
          return {
            ok: false,
            error: data.error || "Invalid phone number or PIN",
          };
        }
        const me = await fetch("/api/profile/me");
        if (me.ok) {
          const meData = await me.json();
          const p = meData.profile || {};
          setProfile({
            uid: String(p.health_id || "profile"),
            phone: String(p.phone || ""),
            health_id: String(p.health_id || ""),
            full_name: String(p.full_name || ""),
            blood_group: String(p.blood_group || ""),
            ...(p as object),
          } as UserProfile);
        }
        setSessionCookie(true);
        setIsDemo(false);
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : "Login failed",
        };
      }
    },
    []
  );

  const setDemoSession = useCallback((p?: UserProfile) => {
    const profileData = p || getDemoProfile();
    localStorage.setItem("kavach_demo_session", "1");
    localStorage.setItem("kavach_demo_profile", JSON.stringify(profileData));
    setIsDemo(true);
    setProfile(profileData);
    setSessionCookie(true);
  }, []);

  const signOut = useCallback(async () => {
    localStorage.removeItem("kavach_demo_session");
    localStorage.removeItem("kavach_demo_profile");
    setIsDemo(false);
    setProfile(null);
    setSessionCookie(false);
    const { auth } = await import("@/lib/firebase");
    const { signOut: firebaseSignOut } = await import("firebase/auth");
    if (auth.currentUser) await firebaseSignOut(auth);
  }, []);

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      isDemo,
      refreshProfile,
      signOut,
      loginWithPin,
      setDemoSession,
    }),
    [
      user,
      profile,
      loading,
      isDemo,
      refreshProfile,
      signOut,
      loginWithPin,
      setDemoSession,
    ]
  );

  return <AuthContextProvider value={value}>{children}</AuthContextProvider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
