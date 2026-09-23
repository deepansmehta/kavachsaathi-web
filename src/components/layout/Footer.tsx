"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Shield, Mail, Phone, MapPin } from "lucide-react";
import { GoldDivider } from "@/components/ui/GoldDivider";

export function Footer() {
  const pathname = usePathname();
  if (pathname?.startsWith("/e/")) return null;

  return (
    <footer className="border-t border-kavach-border bg-kavach-s1 grid-pattern">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg gold-gradient">
                <Shield className="h-5 w-5 text-kavach-black" />
              </div>
              <span className="font-rajdhani text-xl font-bold text-gold">
                KavachSaathi
              </span>
            </div>
            <p className="max-w-md font-body text-sm leading-relaxed text-cream-soft">
              India&apos;s first smart PVC health card platform. Instant
              emergency medical access in 3 seconds — no app, no login, just
              scan.
            </p>
            <p className="mt-4 font-rajdhani text-sm font-semibold text-cream">
              A product of GDM Technoworld Pvt. Ltd.
            </p>
            <p className="mt-2 font-body text-xs text-cream-soft">
              Directors: Saurabh Mehta · Jyoti Mehta
            </p>
          </div>

          <div>
            <h4 className="mb-4 font-rajdhani text-sm font-bold uppercase tracking-widest text-gold">
              Quick Links
            </h4>
            <ul className="space-y-2 font-body text-sm text-cream-soft">
              {[
                ["/activate", "Activate Card"],
                ["/order", "Order Card"],
                ["/doctor", "Doctor Portal"],
                ["/login", "Login"],
              ].map(([href, label]) => (
                <li key={href}>
                  <Link href={href} className="hover:text-gold">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-4 font-rajdhani text-sm font-bold uppercase tracking-widest text-gold">
              Contact
            </h4>
            <ul className="space-y-3 font-body text-sm text-cream-soft">
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-gold" />
                <a href="mailto:hello@kavachsaathi.in" className="hover:text-gold">
                  hello@kavachsaathi.in
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-gold" />
                <a href="tel:+919416106511" className="hover:text-gold">
                  +91 94161 06511
                </a>
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                <span>India</span>
              </li>
            </ul>
          </div>
        </div>

        <GoldDivider className="my-8" />

        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="font-body text-xs text-cream-soft">
            © {new Date().getFullYear()} GDM Technoworld Pvt. Ltd. All rights
            reserved.
          </p>
          <p className="font-rajdhani text-xs font-semibold uppercase tracking-wider text-gold">
            Made in India
          </p>
        </div>
      </div>
    </footer>
  );
}
