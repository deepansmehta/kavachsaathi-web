"use client";

import { ReactNode } from "react";

/** Keep layout wrappers stable — do not remount children on route change */
export function Providers({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
