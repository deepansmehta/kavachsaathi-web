"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { GoldButton } from "@/components/ui/GoldButton";
import { OutlineButton } from "@/components/ui/OutlineButton";
import { useAuth } from "@/contexts/AuthContext";

const publicLinks = [
  { href: "/", label: "Home" },
  { href: "/activate", label: "Activate" },
  { href: "/order", label: "Order" },
  { href: "/doctor", label: "Doctor" },
];

const appLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/my-card", label: "My Card" },
  { href: "/profile/edit", label: "Profile" },
  { href: "/scan-history", label: "Scans" },
];

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { user, profile, loading, isDemo } = useAuth();
  const loggedIn = Boolean(user || isDemo || profile);

  if (pathname?.startsWith("/e/")) return null;

  const links = loggedIn ? appLinks : publicLinks;

  return (
    <header className="sticky top-0 z-50 border-b border-kavach-border glass">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href={loggedIn ? "/dashboard" : "/"} className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg gold-gradient">
            <Shield className="h-5 w-5 text-kavach-black" />
          </div>
          <span className="font-rajdhani text-xl font-bold text-gold">
            KavachSaathi
          </span>
        </Link>

        <div className="hidden items-center gap-6 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "font-rajdhani text-sm font-semibold uppercase tracking-wider transition-colors hover:text-gold",
                pathname === link.href || pathname?.startsWith(link.href + "/")
                  ? "text-gold"
                  : "text-cream-soft"
              )}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          {!loading && loggedIn ? (
            <Link href="/dashboard">
              <GoldButton size="sm">Dashboard</GoldButton>
            </Link>
          ) : (
            <>
              <Link href="/login">
                <OutlineButton size="sm">Login</OutlineButton>
              </Link>
              <Link href="/activate">
                <GoldButton size="sm">Activate</GoldButton>
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          className="text-gold md:hidden"
          onClick={() => setOpen((o) => !o)}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-kavach-border md:hidden"
          >
            <div className="flex flex-col gap-4 bg-kavach-s1 px-4 py-5">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "font-rajdhani text-base font-semibold uppercase tracking-wider",
                    pathname === link.href ? "text-gold" : "text-cream"
                  )}
                >
                  {link.label}
                </Link>
              ))}
              {!loggedIn && (
                <Link href="/login" onClick={() => setOpen(false)}>
                  <OutlineButton fullWidth>Login</OutlineButton>
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
