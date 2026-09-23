"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { History, MapPin, Building2, User } from "lucide-react";
import { LoadingSpinner } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { getUserScans } from "@/lib/firestore";
import type { DoctorScan } from "@/lib/types";
import { getDemoProfile } from "@/lib/demo";

export default function ScanHistoryPage() {
  const router = useRouter();
  const { user, profile, loading, isDemo } = useAuth();
  const [scans, setScans] = useState<DoctorScan[]>([]);
  const [fetching, setFetching] = useState(true);
  const data = profile || (isDemo ? getDemoProfile() : null);

  useEffect(() => {
    if (!loading && !user && !isDemo && !profile) {
      router.replace("/login?next=/scan-history");
    }
  }, [loading, user, isDemo, profile, router]);

  useEffect(() => {
    if (!data?.uid) return;
    setFetching(true);
    getUserScans(data.uid)
      .then(setScans)
      .finally(() => setFetching(false));
  }, [data?.uid]);

  if (loading || fetching) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoadingSpinner label="Loading scans..." />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-kavach-black grid-pattern px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto max-w-lg"
      >
        <div className="mb-8 text-center">
          <History className="mx-auto mb-3 h-8 w-8 text-gold" />
          <h1 className="font-rajdhani text-3xl font-bold text-cream">
            Scan History
          </h1>
          <p className="mt-2 font-mono text-2xl text-gold">{scans.length}</p>
          <p className="font-rajdhani text-xs uppercase tracking-widest text-cream-soft">
            Total scans
          </p>
        </div>

        {scans.length === 0 ? (
          <div className="rounded-card border border-kavach-border bg-kavach-s1 p-8 text-center">
            <p className="font-rajdhani text-lg font-semibold text-cream">
              No scans yet
            </p>
            <p className="mt-2 font-body text-sm text-cream-soft">
              When someone scans your emergency QR, it will appear here.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {scans.map((s) => (
              <li
                key={s.id || s.scanned_at}
                className="rounded-card border border-kavach-border bg-kavach-s1 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-2 font-rajdhani text-lg font-semibold text-cream">
                      <User className="h-4 w-4 text-gold" />
                      {s.scanned_by || "Unknown scanner"}
                    </p>
                    {s.hospital && (
                      <p className="mt-1 flex items-center gap-2 font-body text-sm text-cream-soft">
                        <Building2 className="h-3.5 w-3.5" />
                        {s.hospital}
                      </p>
                    )}
                    {s.location && (
                      <p className="mt-1 flex items-center gap-2 font-body text-sm text-cream-soft">
                        <MapPin className="h-3.5 w-3.5" />
                        {s.location}
                      </p>
                    )}
                    {s.notes && (
                      <p className="mt-2 font-body text-sm text-cream">
                        {s.notes}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-mono text-xs text-gold">
                      {format(new Date(s.scanned_at), "dd MMM yyyy")}
                    </p>
                    <p className="font-mono text-xs text-cream-soft">
                      {format(new Date(s.scanned_at), "hh:mm a")}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </motion.div>
    </div>
  );
}
