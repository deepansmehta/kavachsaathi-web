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
import { onAuthStateChanged, signOut as firebaseSignOut, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import {
  auth,
  db,
  initPersistentAuth,
  hashPin,
  loginWithCustomToken,
  isFirebaseConfigured,
} from "@/lib/firebase";
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);

  const loadProfile = useCallback(async (uid: string) => {
    try {
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
    if (auth.currentUser) await loadProfile(auth.currentUser.uid);
  }, [isDemo, loadProfile]);

  useEffect(() => {
    let unsub = () => {};

    (async () => {
      await initPersistentAuth();

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

    return () => unsub();
  }, [loadProfile]);

  const loginWithPin = useCallback(
    async (
      identifier: string,
      pin: string,
      loginType: "phone" | "health_id"
    ) => {
      try {
        const pinHash = await hashPin(pin);
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier, pinHash, loginType }),
        });
        const data = await res.json();
        if (!res.ok || !data.customToken) {
          return { ok: false, error: data.error || "Invalid credentials" };
        }
        await loginWithCustomToken(data.customToken);
        setSessionCookie(true);
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

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
