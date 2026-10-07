import Link from "next/link";
import { Shield } from "lucide-react";

export default function EmergencyNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-kavach-black px-4 text-center">
      <Shield className="mb-4 h-12 w-12 text-gold" />
      <h1 className="font-rajdhani text-3xl font-bold text-cream">
        Card Not Found
      </h1>
      <p className="mt-2 max-w-sm font-body text-cream-soft">
        Invalid code or card not activated yet.
      </p>
      <Link
        href="/"
        className="mt-6 font-rajdhani text-sm font-semibold text-gold hover:underline"
      >
        Back to home
      </Link>
    </div>
  );
}
