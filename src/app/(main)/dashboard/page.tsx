"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import {
  Copy,
  CreditCard,
  History,
  UserRound,
  Bell,
  Download,
  LogOut,
  Shield,
} from "lucide-react";
import {
  LoadingSpinner,
  Badge,
  GoldButton,
  OutlineButton,
  HealthCard3D,
  BloodGroupBadge,
} from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import {
  getUserScans,
  getUnreadNotificationCount,
  getUserNotifications,
  type AppNotification,
} from "@/lib/firestore";
import type { DoctorScan } from "@/lib/types";
import { timeAgo } from "@/lib/utils";
import { getDemoProfile } from "@/lib/demo";

const PWA_KEY = "kavach_pwa_banner_seen";

export default function DashboardPage() {
  const router = useRouter();
  const { user, profile, loading, isDemo, signOut } = useAuth();
  const [scans, setScans] = useState<DoctorScan[]>([]);
  const [notifs, setNotifs] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [showPwa, setShowPwa] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<{
    prompt: () => Promise<void>;
  } | null>(null);

  const data = profile || (isDemo ? getDemoProfile() : null);

  useEffect(() => {
    if (!loading && !user && !isDemo && !profile) {
      router.replace("/login?next=/dashboard");
    }
  }, [loading, user, isDemo, profile, router]);

  useEffect(() => {
    if (!data?.uid) return;
    getUserScans(data.uid).then((s) => setScans(s.slice(0, 3)));
    getUserNotifications(data.uid).then(setNotifs);
    getUnreadNotificationCount(data.uid).then(setUnread);
  }, [data?.uid]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(PWA_KEY)) return;
    setShowPwa(true);
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as unknown as { prompt: () => Promise<void> });
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const copyHealthId = () => {
    if (!data?.health_id) return;
    navigator.clipboard.writeText(data.health_id);
    toast.success("Health ID copied");
  };

  const installPwa = async () => {
    localStorage.setItem(PWA_KEY, "1");
    setShowPwa(false);
    if (deferredPrompt) await deferredPrompt.prompt();
    else toast("Add to Home Screen from your browser menu");
  };

  if (loading || !data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-kavach-black">
        <LoadingSpinner size="lg" label="Loading dashboard..." />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-kavach-black grid-pattern px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap items-start justify-between gap-4"
        >
          <div>
            <p className="font-rajdhani text-sm font-semibold uppercase tracking-widest text-gold">
              Namaste
            </p>
            <h1 className="font-rajdhani text-3xl font-bold text-cream">
              {data.full_name || "User"}
            </h1>
            <button
              type="button"
              onClick={copyHealthId}
              className="mt-1 inline-flex items-center gap-2 font-mono text-sm text-gold hover:underline"
            >
              {data.health_id}
              <Copy className="h-3.5 w-3.5" />
              {unread > 0 && (
                <span className="ml-1 inline-flex items-center gap-1 rounded-badge bg-danger/20 px-2 py-0.5 text-xs text-danger">
                  <Bell className="h-3 w-3" />
                  {unread}
                </span>
              )}
            </button>
          </div>
          <OutlineButton
            size="sm"
            onClick={async () => {
              await signOut();
              router.push("/");
            }}
          >
            <LogOut className="h-4 w-4" />
            Logout
          </OutlineButton>
        </motion.div>

        {showPwa && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-gold-border bg-kavach-s1 p-4">
            <div className="flex items-center gap-3">
              <Download className="h-5 w-5 text-gold" />
              <div>
                <p className="font-rajdhani font-semibold text-cream">
                  Install KavachSaathi
                </p>
                <p className="font-body text-xs text-cream-soft">
                  Add to home screen for instant access
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <OutlineButton
                size="sm"
                onClick={() => {
                  localStorage.setItem(PWA_KEY, "1");
                  setShowPwa(false);
                }}
              >
                Later
              </OutlineButton>
              <GoldButton size="sm" onClick={installPwa}>
                Install
              </GoldButton>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="flex flex-col items-center rounded-card border border-kavach-border bg-kavach-s1 p-4">
            <BloodGroupBadge bloodGroup={data.blood_group} size="md" />
            <p className="mt-2 font-rajdhani text-xs uppercase tracking-wider text-cream-soft">
              Blood
            </p>
          </div>
          {[
            ["Allergies", data.allergies?.length || 0],
            ["Meds", data.medications?.length || 0],
            ["Conditions", data.medical_conditions?.length || 0],
          ].map(([label, count]) => (
            <div
              key={label as string}
              className="rounded-card border border-kavach-border bg-kavach-s1 p-4 text-center"
            >
              <p className="font-mono text-3xl font-bold text-gold">{count}</p>
              <p className="mt-1 font-rajdhani text-xs uppercase tracking-wider text-cream-soft">
                {label}
              </p>
            </div>
          ))}
        </div>

        <div className="rounded-card border border-kavach-border bg-kavach-s1 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-rajdhani text-lg font-bold text-cream">
              Your Card
            </h2>
            <Badge>{data.tier || "STANDARD"}</Badge>
          </div>
          <HealthCard3D
            bloodGroup={data.blood_group}
            tier={data.tier || "STANDARD"}
            activationCode={data.activation_code}
            interactive
          />
        </div>

        <div className="rounded-card border border-kavach-border bg-kavach-s1 p-5">
          <div className="mb-4 flex items-center gap-2">
            <Bell className="h-5 w-5 text-gold" />
            <h2 className="font-rajdhani text-lg font-bold text-cream">
              Notifications
            </h2>
            {unread > 0 && (
              <span className="rounded-badge bg-danger/20 px-2 py-0.5 font-mono text-xs text-danger">
                {unread} new
              </span>
            )}
          </div>
          {notifs.length === 0 ? (
            <p className="font-body text-sm text-cream-soft">
              No notifications yet. You&apos;ll see alerts when your card is
              scanned.
            </p>
          ) : (
            <ul className="space-y-3">
              {notifs.slice(0, 5).map((n) => (
                <li
                  key={n.id}
                  className="flex items-start justify-between gap-3 border-b border-kavach-border/40 pb-3 last:border-0"
                >
                  <p
                    className={`font-body text-sm ${
                      n.read ? "text-cream-soft" : "text-cream"
                    }`}
                  >
                    {!n.read && (
                      <span className="mr-2 inline-block h-2 w-2 rounded-full bg-gold" />
                    )}
                    {n.message}
                  </p>
                  <span className="shrink-0 font-mono text-xs text-gold">
                    {timeAgo(n.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-card border border-kavach-border bg-kavach-s1 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-rajdhani text-lg font-bold text-cream">
              Recent Scans
            </h2>
            <Link
              href="/scan-history"
              className="font-rajdhani text-sm text-gold hover:underline"
            >
              View all
            </Link>
          </div>
          {scans.length === 0 ? (
            <p className="font-body text-sm text-cream-soft">
              No scans yet. Your emergency QR is ready when needed.
            </p>
          ) : (
            <ul className="space-y-3">
              {scans.map((s) => (
                <li
                  key={s.id || s.scanned_at}
                  className="flex items-center justify-between border-b border-kavach-border/40 pb-3 last:border-0"
                >
                  <div>
                    <p className="font-rajdhani font-semibold text-cream">
                      {s.scanned_by || "Unknown"}
                    </p>
                    <p className="font-body text-xs text-cream-soft">
                      {s.hospital || s.location || "—"}
                    </p>
                  </div>
                  <span className="font-mono text-xs text-gold">
                    {timeAgo(s.scanned_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            {
              href: "/profile/edit",
              icon: UserRound,
              label: "Edit Profile",
            },
            { href: "/scan-history", icon: History, label: "Scan History" },
            { href: "/my-card", icon: CreditCard, label: "My Card" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-card border border-kavach-border bg-kavach-s1 p-4 transition-all hover:border-gold hover:shadow-gold-sm"
            >
              <item.icon className="h-5 w-5 text-gold" />
              <span className="font-rajdhani font-semibold text-cream">
                {item.label}
              </span>
            </Link>
          ))}
        </div>

          <p className="flex items-center justify-center gap-2 pt-4 font-body text-xs text-cream-soft">
          <Shield className="h-3.5 w-3.5 text-gold" />
          Keep your card QR ready for emergencies
        </p>
      </div>
    </div>
  );
}
