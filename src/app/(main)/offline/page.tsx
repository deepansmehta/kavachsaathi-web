"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Shield } from "lucide-react";
import { GoldButton } from "@/components/ui";
import {
  hasOfflineEmergencyCard,
  loadOfflineEmergencyCard,
  type OfflineEmergencyCard,
} from "@/lib/pwa/offlineCard";

export default function OfflinePage() {
  const [hasCard, setHasCard] = useState(false);
  const [pin, setPin] = useState("");
  const [card, setCard] = useState<OfflineEmergencyCard | null>(null);
  const [err, setErr] = useState("");
  const [flags, setFlags] = useState<{ pwaApp?: boolean }>({});

  useEffect(() => {
    void hasOfflineEmergencyCard().then(setHasCard).catch(() => setHasCard(false));
    // flags may be unavailable offline — treat pwaApp as on if card exists
    fetch("/api/features")
      .then((r) => r.json())
      .then((d) => setFlags(d.flags || {}))
      .catch(() => setFlags({ pwaApp: true }));
  }, []);

  const unlock = async () => {
    setErr("");
    try {
      const c = await loadOfflineEmergencyCard(pin);
      setCard(c);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Unlock failed");
    }
  };

  if (card) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col bg-black px-4 py-8 text-[var(--cream)]">
        <p className="mb-2 text-center text-xs uppercase tracking-widest text-[var(--gold)]">
          My Emergency Card
        </p>
        <h1 className="font-rajdhani text-3xl font-bold">{card.name}</h1>
        <p className="mt-2 text-4xl font-bold text-[var(--gold)]">{card.bloodGroup}</p>
        {card.autoSummary?.en ? (
          <p className="mt-4 rounded-lg border border-[var(--gold-border)] bg-[var(--kavach-s1)] p-3 text-sm">
            {card.autoSummary.en}
          </p>
        ) : null}
        {card.criticalFlags?.length ? (
          <div className="mt-4 space-y-2">
            {card.criticalFlags.map((f) => (
              <div
                key={f}
                className="rounded-lg bg-red-700 px-3 py-2 text-center text-sm font-bold text-white"
              >
                {f}
              </div>
            ))}
          </div>
        ) : null}
        <Section title="Allergies" body={card.allergies.join(", ") || "—"} />
        <Section title="Conditions" body={card.conditions.join(", ") || "—"} />
        <Section title="Medicines" body={card.medicines.join(", ") || "—"} />
        <Section
          title="Emergency contacts"
          body={
            card.emergencyContacts
              .map((c) => `${c.name}${c.relation ? ` (${c.relation})` : ""}: ${c.phone}`)
              .join("\n") || "—"
          }
        />
        <p className="mt-6 text-center text-xs text-[var(--text-soft)]">
          Saved on {new Date(card.savedAt).toLocaleString("en-IN")} — reconnect to update
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black px-4 text-center">
      <Shield className="mb-4 h-12 w-12 text-gold" />
      <h1 className="font-rajdhani text-3xl font-bold text-cream">
        You&apos;re Offline
      </h1>
      <p className="mt-2 max-w-sm font-dm text-cream-soft">
        App shell is available offline. Other people&apos;s cards are never cached on this
        phone.
      </p>
      {(flags.pwaApp !== false && hasCard) || hasCard ? (
        <div className="mt-6 w-full max-w-xs space-y-3 text-left">
          <p className="text-sm text-[var(--gold)]">My Emergency Card</p>
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            placeholder="Enter PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="w-full rounded-lg border border-[var(--gold-border)] bg-black/60 px-3 py-2 text-[var(--cream)]"
          />
          {err ? <p className="text-sm text-red-400">{err}</p> : null}
          <GoldButton className="w-full" onClick={() => void unlock()}>
            Unlock offline card
          </GoldButton>
        </div>
      ) : null}
      <Link href="/" className="mt-8">
        <GoldButton>Try Again</GoldButton>
      </Link>
    </div>
  );
}

function Section({ title, body }: { title: string; body: string }) {
  return (
    <div className="mt-4 rounded-xl border border-[var(--gold-border)] bg-[var(--kavach-s1)] p-3 text-left">
      <p className="text-xs uppercase tracking-wider text-[var(--gold)]">{title}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm">{body}</p>
    </div>
  );
}
