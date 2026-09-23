"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface StepIndicatorProps {
  steps: string[];
  current: number;
  className?: string;
}

export function StepIndicator({
  steps,
  current,
  className,
}: StepIndicatorProps) {
  const progress = ((current) / (steps.length - 1)) * 100;

  return (
    <div className={cn("w-full", className)}>
      <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-black-4">
        <div
          className="h-full rounded-full gold-gradient transition-all duration-500 ease-out"
          style={{ width: `${Math.max(progress, 0)}%` }}
        />
      </div>
      <div className="flex justify-between gap-1">
        {steps.map((label, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <div
              key={label}
              className="flex flex-1 flex-col items-center gap-2"
            >
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border font-mono text-xs font-bold transition-all",
                  done && "border-gold bg-gold text-black",
                  active && "border-gold bg-gold-faint text-gold shadow-gold-sm",
                  !done && !active && "border-gold-border bg-black-3 text-cream-soft"
                )}
              >
                {done ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span
                className={cn(
                  "hidden text-center font-rajdhani text-[10px] font-semibold uppercase tracking-wider sm:block",
                  active ? "text-gold" : "text-cream-soft"
                )}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
