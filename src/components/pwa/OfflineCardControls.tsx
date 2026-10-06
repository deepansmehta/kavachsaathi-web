"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  saveOfflineEmergencyCard,
  removeOfflineEmergencyCard,
  offlineCardMeta,
  type OfflineEmergencyCard,
} from "@/lib/pwa/offlineCard";
import { buildAutoSummaryPair } from "@/lib/autoSummary";

type Props = {
  featureOn: boolean;
  healthId: string;
  name: string;
  bloodGroup: string;
  allergies: string[];
  conditions: string[];
  medicines: string[];
  criticalFlags: string[];
  contacts: { name: string; phone: string; relation?: string }[];
  photoThumbnail?: string | null;
  pin: string;
};

/** F55 — Save / remove owner emergency card on this phone (PIN-encrypted). */
export function OfflineCardControls({
  featureOn,
  healthId,
  name,
  bloodGroup,
  allergies,
  conditions,
  medicines,
  criticalFlags,
  contacts,
  photoThumbnail,
  pin,
}: Props) {
  const [meta, setMeta] = useState<{ savedAt?: string; healthId?: string } | null>(
    null
  );
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    void offlineCardMeta().then(setMeta).catch(() => setMeta(null));
  }, []);

  useEffect(() => {
    if (featureOn) refresh();
  }, [featureOn, refresh]);

  if (!featureOn) return null;

  const save = async () => {
    if (!pin || pin.length < 4) {
      toast.error("Enter your PIN to encrypt the offline card");
      return;
    }
    setBusy(true);
    try {
      const summary = buildAutoSummaryPair({
        publicOnly: true,
        bloodGroup,
        allergies,
        conditions,
        medications: medicines,
        criticalFlags,
        emergencyContact: contacts[0] || null,
      });
      const card: OfflineEmergencyCard = {
        name,
        photoThumbnail: photoThumbnail || null,
        bloodGroup,
        allergies,
        conditions,
        medicines,
        criticalFlags,
        emergencyContacts: contacts,
        autoSummary: summary,
        savedAt: new Date().toISOString(),
        healthId,
      };
      await saveOfflineEmergencyCard(pin, card);
      toast.success("Emergency card saved on this phone");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await removeOfflineEmergencyCard();
      toast.success("Removed from this phone");
      refresh();
    } catch {
      toast.error("Remove failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2 rounded-xl border border-[var(--gold-border)] p-4">
      <p className="font-rajdhani text-sm font-bold uppercase tracking-wider text-[var(--gold)]">
        Offline emergency card
      </p>
      <p className="text-xs text-[var(--text-soft)]">
        Stores only emergency fields on this phone, encrypted with your PIN. No IDs,
        address, insurance, or documents.
      </p>
      {meta?.savedAt ? (
        <p className="text-sm text-[var(--cream)]">
          Saved on {new Date(meta.savedAt).toLocaleString("en-IN")} — reconnect to
          update
        </p>
      ) : (
        <p className="text-sm text-[var(--text-soft)]">Not saved on this phone</p>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() => void save()}
        className="w-full rounded-lg border border-[var(--gold)] px-3 py-2 text-sm text-[var(--gold)]"
      >
        Save my emergency card on this phone
      </button>
      {meta?.savedAt ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void remove()}
          className="w-full rounded-lg border border-red-500/60 px-3 py-2 text-sm text-red-300"
        >
          Remove from this phone
        </button>
      ) : null}
    </div>
  );
}
