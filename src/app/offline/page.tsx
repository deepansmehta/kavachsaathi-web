"use client";

import Link from "next/link";
import { Shield } from "lucide-react";
import { GoldButton } from "@/components/ui";

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black px-4 text-center">
      <Shield className="mb-4 h-12 w-12 text-gold" />
      <h1 className="font-rajdhani text-3xl font-bold text-cream">
        You&apos;re Offline
      </h1>
      <p className="mt-2 max-w-sm font-dm text-cream-soft">
        Check your connection. Emergency pages may still work from cache if
        previously opened.
      </p>
      <Link href="/" className="mt-8">
        <GoldButton>Try Again</GoldButton>
      </Link>
    </div>
  );
}
