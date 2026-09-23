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
      <p className="mt-4 font-body text-sm text-cream-soft">
        Demo:{" "}
        <Link href="/e/0042" className="text-gold underline">
          /e/0042
        </Link>
      </p>
    </div>
  );
}
