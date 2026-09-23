"use client";

import {
  useRef,
  useState,
  useEffect,
  KeyboardEvent,
  ClipboardEvent,
  ChangeEvent,
} from "react";
import { cn } from "@/lib/utils";

interface OTPInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
  className?: string;
}

export function OTPInput({
  length = 4,
  value,
  onChange,
  error,
  disabled,
  className,
}: OTPInputProps) {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const [chars, setChars] = useState<string[]>(
    Array.from({ length }, (_, i) => value[i] || "")
  );

  useEffect(() => {
    const next = Array.from({ length }, (_, i) =>
      (value[i] || "").toUpperCase()
    );
    setChars(next);
  }, [value, length]);

  const emit = (next: string[]) => {
    setChars(next);
    onChange(next.join("").toUpperCase());
  };

  const handleChange = (index: number, e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    if (!raw) {
      const next = [...chars];
      next[index] = "";
      emit(next);
      return;
    }
    const digit = raw.slice(-1);
    const next = [...chars];
    next[index] = digit;
    emit(next);
    if (index < length - 1) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !chars[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && index > 0) {
      inputs.current[index - 1]?.focus();
    }
    if (e.key === "ArrowRight" && index < length - 1) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData("text")
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase()
      .slice(0, length);
    if (!pasted) return;
    const next = Array.from({ length }, (_, i) => pasted[i] || "");
    emit(next);
    const focusIdx = Math.min(pasted.length, length - 1);
    inputs.current[focusIdx]?.focus();
  };

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <div className="flex gap-3">
        {Array.from({ length }).map((_, i) => (
          <input
            key={i}
            ref={(el) => {
              inputs.current[i] = el;
            }}
            type="text"
            inputMode="text"
            autoComplete="one-time-code"
            maxLength={1}
            disabled={disabled}
            value={chars[i] || ""}
            onChange={(e) => handleChange(i, e)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={handlePaste}
            aria-label={`Digit ${i + 1}`}
            className={cn(
              "h-14 w-14 rounded-input border bg-black-3 text-center font-mono text-2xl font-bold text-gold outline-none transition-all focus:border-gold focus:shadow-gold-glow sm:h-16 sm:w-16",
              error ? "border-danger" : "border-gold-border",
              chars[i] && "border-gold bg-gold-faint"
            )}
          />
        ))}
      </div>
      {error && (
        <p className="font-dm text-sm text-danger">{error}</p>
      )}
    </div>
  );
}
