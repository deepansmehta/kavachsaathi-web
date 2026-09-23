"use client";

import { InputHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

interface GoldInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  bare?: boolean;
}

export const GoldInput = forwardRef<HTMLInputElement, GoldInputProps>(
  ({ label, error, hint, className, id, bare, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

    const input = (
      <input
        ref={ref}
        id={inputId}
        className={cn(
          "w-full rounded-input border bg-kavach-s2 px-4 py-3 font-body text-cream outline-none transition-all placeholder:text-cream-soft/40 focus:border-gold focus:shadow-gold-sm",
          error ? "border-danger" : "border-gold-border",
          className
        )}
        {...props}
      />
    );

    if (bare) return input;

    return (
      <div className="flex w-full flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="font-rajdhani text-sm font-semibold uppercase tracking-widest text-cream-soft"
          >
            {label}
            {props.required && <span className="ml-1 text-danger">*</span>}
          </label>
        )}
        {input}
        {error && <p className="font-body text-xs text-danger">{error}</p>}
        {hint && !error && (
          <p className="font-body text-xs text-cream-soft">{hint}</p>
        )}
      </div>
    );
  }
);

GoldInput.displayName = "GoldInput";
