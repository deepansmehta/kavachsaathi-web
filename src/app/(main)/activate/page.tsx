import Link from "next/link";

/**
 * Legacy /activate multi-step Auth activation UI — retired.
 * Cards activate only via the QR → /card/{health_id} 7-step wizard.
 */
export default function ActivateRetiredPage() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <h1 className="text-2xl font-bold text-[#D4AF37]">Activation moved</h1>
      <p className="text-sm text-[#A8A59C]">
        This page is no longer used. Scan the QR on your KavachSaathi card (or open
        the link printed with it) to start the secure 7-step activation wizard.
      </p>
      <Link
        href="/"
        className="rounded-lg bg-gradient-to-r from-[#FCE49A] to-[#B8860B] px-5 py-2.5 text-sm font-semibold text-black"
      >
        Back to home
      </Link>
    </main>
  );
}
