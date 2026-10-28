"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Shield, Mail, Phone, MapPin } from "lucide-react";
import { GoldDivider } from "@/components/ui/GoldDivider";
import { COMPANY } from "@/lib/pricing";

const POLICY_LINKS: [string, string][] = [
  ["/shipping", "Shipping"],
  ["/returns", "Returns & Refunds"],
  ["/privacy", "Privacy Policy"],
  ["/terms", "Terms & Conditions"],
  ["/contact", "Contact Us"],
];

const QUICK_LINKS: [string, string][] = [
  ["/activate", "Activate Card"],
  ["/order", "Order Card"],
  ["/pricing", "Pricing"],
  ["/doctor", "Doctor Portal"],
  ["/login", "Login"],
];

export function Footer() {
  const pathname = usePathname();
  if (
    pathname?.startsWith("/e/") ||
    pathname?.startsWith("/emergency/") ||
    pathname?.startsWith("/card/")
  ) {
    return null;
  }

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
              <a
                href={COMPANY.website}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-gold"
              >
                {COMPANY.productLine}
              </a>
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
              {QUICK_LINKS.map(([href, label]) => (
                <li key={href}>
                  <Link href={href} className="hover:text-gold">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
            <h4 className="mb-3 mt-6 font-rajdhani text-sm font-bold uppercase tracking-widest text-gold">
              Policies
            </h4>
            <ul className="space-y-2 font-body text-sm text-cream-soft">
              {POLICY_LINKS.map(([href, label]) => (
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
                <a
                  href={`mailto:${COMPANY.email}`}
                  className="hover:text-gold"
                >
                  {COMPANY.email}
                </a>
              </li>
              {COMPANY.phones.map((p) => (
                <li key={p.tel} className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-gold" />
                  <a href={`tel:${p.tel}`} className="hover:text-gold">
                    {p.display}
                  </a>
                </li>
              ))}
              <li className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                <span>{COMPANY.addressLine}</span>
              </li>
            </ul>
          </div>
        </div>

        <GoldDivider className="my-8" />

        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="font-body text-xs text-cream-soft">
            © {new Date().getFullYear()} {COMPANY.legalName}. All rights
            reserved.{" "}
            {POLICY_LINKS.map(([href, label], i) => (
              <span key={href}>
                {i > 0 ? " · " : null}
                <Link href={href} className="hover:text-gold">
                  {label.replace(/ Policy$/, "").replace(/ of Use$/, "")}
                </Link>
              </span>
            ))}
          </p>
          <p className="font-rajdhani text-xs font-semibold uppercase tracking-wider text-gold">
            Made in India
          </p>
        </div>
      </div>
    </footer>
  );
}
