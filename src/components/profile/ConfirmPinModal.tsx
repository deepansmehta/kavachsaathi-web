"use client";

import { useState } from "react";
import { GoldButton, OutlineButton, GoldInput } from "@/components/ui";

type Props = {
  open: boolean;
  title?: string;
  onConfirm: (pin: string) => void | Promise<void>;
  onCancel: () => void;
  loading?: boolean;
};

/** Re-ask PIN before sensitive profile changes */
export function ConfirmPinModal({
  open,
  title = "Confirm with your PIN / पिन से पुष्टि करें",
  onConfirm,
  onCancel,
  loading,
}: Props) {
  const [pin, setPin] = useState("");
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal
      data-testid="confirm-pin-modal"
    >
      <div className="w-full max-w-sm space-y-3 rounded-2xl border border-[var(--gold-border)] bg-[#141410] p-5">
        <h3 className="text-sm font-semibold text-[var(--gold)]">{title}</h3>
        <p className="text-xs text-[var(--text-soft)]">
          Enter your current card PIN to continue. / जारी रखने के लिए वर्तमान
          पिन डालें।
        </p>
        <GoldInput
          label="PIN"
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(e) =>
            setPin(e.target.value.replace(/\D/g, "").slice(0, 6))
          }
          autoFocus
        />
        <div className="flex gap-2">
          <OutlineButton
            className="flex-1"
            onClick={() => {
              setPin("");
              onCancel();
            }}
            disabled={loading}
          >
            Cancel
          </OutlineButton>
          <GoldButton
            className="flex-1"
            disabled={loading || pin.length < 4}
            onClick={() => void onConfirm(pin)}
          >
            {loading ? "…" : "Confirm"}
          </GoldButton>
        </div>
      </div>
    </div>
  );
}
