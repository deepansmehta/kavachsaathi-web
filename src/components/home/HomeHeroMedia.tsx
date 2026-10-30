"use client";

import dynamic from "next/dynamic";

const ECGBackground = dynamic(
  () =>
    import("@/components/ui/ECGBackground").then((m) => ({
      default: m.ECGBackground,
    })),
  { ssr: false, loading: () => null }
);

const PhysicalCardPreview = dynamic(
  () =>
    import("@/components/ui/PhysicalCardPreview").then((m) => ({
      default: m.PhysicalCardPreview,
    })),
  {
    ssr: false,
    loading: () => (
      <div
        className="aspect-square w-full max-w-[320px] rounded-2xl border border-gold/25 bg-[#121210]"
        aria-hidden
      />
    ),
  }
);

/** Client-only hero chrome (ECG + optional real product card). */
export function HomeHeroMedia({ showCard = false }: { showCard?: boolean }) {
  if (showCard) {
    return <PhysicalCardPreview interactive />;
  }
  return <ECGBackground className="opacity-25 max-sm:hidden" />;
}
