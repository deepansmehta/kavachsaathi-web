"use client";

import { useRef, useEffect, KeyboardEvent, ClipboardEvent } from "react";
import { cn } from "@/lib/utils";

interface PinInputProps {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  error?: string;
  className?: string;
  /** Default 4 — activation code / PIN */
  length?: number;
}

/** Native 4-box PIN / code input — no react-otp-input */
export function PinInput({
  value,
  onChange,
  disabled,
  error,
  className,
  length = 4,
}: PinInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(length, " ").slice(0, length).split("");

  useEffect(() => {
    if (!disabled) refs.current[0]?.focus();
  }, [disabled]);

  const setAt = (index: number, char: string) => {
    const next = value.split("");
    while (next.length < length) next.push("");
    next[index] = char;
    onChange(next.join("").replace(/\D/g, "").slice(0, length));
  };

  const onKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (value[i]) {
        setAt(i, "");
      } else if (i > 0) {
        setAt(i - 1, "");
        refs.current[i - 1]?.focus();
      }
      return;
    }
    if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
    if (e.key === "ArrowRight" && i < length - 1) refs.current[i + 1]?.focus();
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, length);
    if (pasted) {
      onChange(pasted);
      refs.current[Math.min(pasted.length, length - 1)]?.focus();
    }
  };

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div className="flex justify-center gap-3">
        {Array.from({ length }).map((_, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="tel"
            inputMode="numeric"
            maxLength={1}
            disabled={disabled}
            value={digits[i]?.trim() ? digits[i] : ""}
            aria-label={`Digit ${i + 1}`}
            onChange={(e) => {
              const d = e.target.value.replace(/\D/g, "").slice(-1);
              if (!d) {
                setAt(i, "");
                return;
              }
              setAt(i, d);
              if (i < length - 1) refs.current[i + 1]?.focus();
            }}
            onKeyDown={(e) => onKeyDown(i, e)}
            onPaste={onPaste}
            onFocus={(e) => e.target.select()}
            className={cn(
              "h-14 w-14 rounded-input border bg-kavach-s2 text-center font-mono text-2xl font-bold text-gold outline-none focus:border-gold focus:shadow-gold-glow disabled:opacity-50",
              error ? "border-danger" : "border-gold-border"
            )}
          />
        ))}
      </div>
      {error && <p className="font-body text-sm text-danger">{error}</p>}
    </div>
  );
}
