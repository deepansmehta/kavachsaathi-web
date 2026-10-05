"use client";

import dynamic from "next/dynamic";

const ECGBackground = dynamic(
  () =>
    import("@/components/ui/ECGBackground").then((m) => ({
      default: m.ECGBackground,
    })),
  { ssr: false, loading: () => null }
);

const HealthCard3D = dynamic(
  () =>
    import("@/components/ui/HealthCard3D").then((m) => ({
      default: m.HealthCard3D,
    })),
  {
    ssr: false,
    loading: () => (
      <div
        className="h-[200px] w-full rounded-2xl border border-gold/25 bg-[#121210]"
        aria-hidden
      />
    ),
  }
);

/** Client-only hero chrome (ECG + optional 3D card). */
export function HomeHeroMedia({ showCard = false }: { showCard?: boolean }) {
  if (showCard) {
    return <HealthCard3D interactive />;
  }
  return <ECGBackground className="opacity-25 max-sm:hidden" />;
}
