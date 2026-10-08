"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import {
  clearLaunchRevealSeen,
  hasSeenLaunchReveal,
  isLaunchRevealPathAllowed,
} from "@/lib/launchReveal";

const LaunchReveal = dynamic(
  () =>
    import("./LaunchReveal").then((m) => ({ default: m.LaunchReveal })),
  { ssr: false, loading: () => null }
);

type Status = {
  mayLoadBundle: boolean;
  inWindow: boolean;
  canReplay: boolean;
  neverAfter: boolean;
  nowMs: number;
};

/**
 * Lazy-mounts the launch reveal on `/` and `/coming-soon` only.
 * Uses server time from /api/launch-reveal/status — never the device clock.
 */
export function LaunchRevealGate({
  forceComingSoonWatch = false,
}: {
  /** When true (coming-soon page), poll until window opens then auto-play. */
  forceComingSoonWatch?: boolean;
} = {}) {
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [rehearsal, setRehearsal] = useState(false);
  const replayArmed = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(async (): Promise<Status | null> => {
    try {
      const r = await fetch(
        `/api/launch-reveal/status?path=${encodeURIComponent(pathname)}`,
        { cache: "no-store" }
      );
      if (!r.ok) return null;
      return (await r.json()) as Status;
    } catch {
      return null;
    }
  }, [pathname]);

  const maybeShow = useCallback(
    async (opts?: { wantReplay?: boolean }) => {
      if (!isLaunchRevealPathAllowed(pathname)) {
        setShow(false);
        return;
      }
      const st = await fetchStatus();
      if (!st || st.neverAfter || !st.mayLoadBundle) {
        setShow(false);
        return;
      }
      if (opts?.wantReplay || replayArmed.current) {
        if (!st.canReplay && !replayArmed.current) {
          setShow(false);
          return;
        }
        if (st.canReplay || replayArmed.current) {
          clearLaunchRevealSeen();
          replayArmed.current = true;
          setRehearsal(true);
          setShow(true);
          return;
        }
      }
      if (st.inWindow && !hasSeenLaunchReveal()) {
        setRehearsal(false);
        setShow(true);
      } else {
        setShow(false);
      }
    },
    [pathname, fetchStatus]
  );

  useEffect(() => {
    if (!isLaunchRevealPathAllowed(pathname)) {
      setShow(false);
      return;
    }
    const wantReplay = searchParams?.get("replayLaunch") === "1";
    if (wantReplay) {
      void (async () => {
        const st = await fetchStatus();
        if (st?.canReplay) {
          clearLaunchRevealSeen();
          replayArmed.current = true;
          setRehearsal(true);
          setShow(true);
          if (typeof window !== "undefined") {
            const u = new URL(window.location.href);
            u.searchParams.delete("replayLaunch");
            router.replace(u.pathname + (u.search || ""));
          }
        }
      })();
      return;
    }
    void maybeShow();

    // Coming-soon: poll every 2s until launch window, then auto-play once
    if (forceComingSoonWatch || pathname === "/coming-soon") {
      let ticks = 0;
      pollRef.current = setInterval(() => {
        ticks += 1;
        if (ticks > 30 * 60) {
          if (pollRef.current) clearInterval(pollRef.current);
          return;
        }
        void maybeShow();
      }, 2000);
      return () => {
        if (pollRef.current) clearInterval(pollRef.current);
      };
    }
  }, [
    pathname,
    searchParams,
    router,
    maybeShow,
    fetchStatus,
    forceComingSoonWatch,
  ]);

  const onDone = useCallback(() => {
    replayArmed.current = false;
    setShow(false);
    // After reveal on coming-soon: re-check gate every 2s up to 60s, then live site
    if (pathname === "/coming-soon") {
      let n = 0;
      const id = setInterval(async () => {
        n += 1;
        try {
          const r = await fetch("/api/time", { cache: "no-store" });
          const j = (await r.json()) as { nowMs?: number };
          // Site is "live" once launch instant has passed (middleware opens)
          if (j.nowMs && j.nowMs >= Date.parse("2026-10-11T12:00:00+05:30")) {
            clearInterval(id);
            window.location.replace("/");
            return;
          }
        } catch {
          /* */
        }
        if (n >= 30) {
          clearInterval(id);
          window.location.replace("/");
        }
      }, 2000);
    }
  }, [pathname]);

  if (!show) return null;
  return <LaunchReveal onDone={onDone} rehearsal={rehearsal} />;
}
