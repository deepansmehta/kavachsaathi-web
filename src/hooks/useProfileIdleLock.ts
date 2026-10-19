"use client";

import { useCallback, useEffect, useRef } from "react";

const IDLE_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Auto-lock profile session after idle; call onLock to logout / clear edit mode.
 */
export function useProfileIdleLock(
  active: boolean,
  onLock: () => void
) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onLockRef = useRef(onLock);
  onLockRef.current = onLock;

  const bump = useCallback(() => {
    if (!active) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      onLockRef.current();
    }, IDLE_MS);
  }, [active]);

  useEffect(() => {
    if (!active) {
      if (timer.current) clearTimeout(timer.current);
      return;
    }
    bump();
    const evs = ["pointerdown", "keydown", "touchstart", "scroll"] as const;
    const handler = () => bump();
    for (const e of evs) window.addEventListener(e, handler, { passive: true });
    return () => {
      if (timer.current) clearTimeout(timer.current);
      for (const e of evs) window.removeEventListener(e, handler);
    };
  }, [active, bump]);

  return { bump };
}
