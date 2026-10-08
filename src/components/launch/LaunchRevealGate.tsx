"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import {
  clearLaunchRevealSeen,
  shouldShowLaunchReveal,
} from "@/lib/launchReveal";
import { LaunchReveal } from "./LaunchReveal";

/**
 * Mounts the cinematic launch reveal on `/` during launch day (once),
 * or anytime with ?replayLaunch=1 (owner). Never on protected routes.
 */
export function LaunchRevealGate() {
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const router = useRouter();
  const [show, setShow] = useState(false);
  /** Keeps reveal mounted after we strip ?replayLaunch=1 from the URL. */
  const replayArmed = useRef(false);

  useEffect(() => {
    const replay = searchParams?.get("replayLaunch") === "1";
    if (replay) {
      clearLaunchRevealSeen();
      replayArmed.current = true;
      if (typeof window !== "undefined") {
        const u = new URL(window.location.href);
        u.searchParams.delete("replayLaunch");
        router.replace(u.pathname + (u.search || ""));
      }
    }
    const ok =
      replayArmed.current ||
      shouldShowLaunchReveal({
        pathname,
        searchParams: searchParams || new URLSearchParams(),
      });
    setShow(ok);
  }, [pathname, searchParams, router]);

  const onDone = useCallback(() => {
    replayArmed.current = false;
    setShow(false);
  }, []);

  if (!show) return null;
  return <LaunchReveal onDone={onDone} />;
}
