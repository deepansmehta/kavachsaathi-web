"use client";

import { KeyboardEvent, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface TagInputProps {
  label?: string;
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  error?: string;
  className?: string;
}

export function TagInput({
  label,
  value,
  onChange,
  placeholder = "Type and press Enter",
  error,
  className,
}: TagInputProps) {
  const [input, setInput] = useState("");

  const addTag = (raw: string) => {
    const tag = raw.trim();
    if (!tag) return;
    if (value.some((t) => t.toLowerCase() === tag.toLowerCase())) {
      setInput("");
      return;
    }
    onChange([...value, tag]);
    setInput("");
  };

  const removeTag = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(input);
    }
    if (e.key === "Backspace" && !input && value.length) {
      removeTag(value.length - 1);
    }
  };

  return (
    <div className={cn("flex w-full flex-col gap-1.5", className)}>
      {label && (
        <label className="font-rajdhani text-sm font-semibold uppercase tracking-widest text-cream-soft">
          {label}
        </label>
      )}
      <div
        className={cn(
          "flex min-h-[52px] flex-wrap items-center gap-2 rounded-input border bg-black-3 px-3 py-2 transition-all focus-within:border-gold focus-within:shadow-gold-sm",
          error ? "border-danger" : "border-gold-border"
        )}
      >
        {value.map((tag, i) => (
          <span
            key={`${tag}-${i}`}
            className="inline-flex items-center gap-1.5 rounded-badge border border-gold-border bg-gold-faint px-2.5 py-1 font-rajdhani text-xs font-semibold text-gold"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(i)}
              className="hover:text-gold-light"
              aria-label={`Remove ${tag}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => addTag(input)}
          placeholder={value.length === 0 ? placeholder : ""}
          className="min-w-[120px] flex-1 bg-transparent py-1 font-dm text-sm text-cream outline-none placeholder:text-cream-soft/40"
        />
      </div>
      {error && <p className="font-dm text-xs text-danger">{error}</p>}
    </div>
  );
}
