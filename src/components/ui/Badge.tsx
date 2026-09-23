import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "gold" | "red" | "green" | "orange" | "blue" | "outline";
}

export function Badge({
  children,
  className,
  variant = "gold",
  ...props
}: BadgeProps) {
  const variants = {
    gold: "bg-gold-faint text-gold border-gold-border",
    red: "bg-red-500/15 text-red-400 border-red-500/30",
    green: "bg-green-500/15 text-green-400 border-green-500/30",
    orange: "bg-orange-500/15 text-orange-400 border-orange-500/30",
    blue: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    outline: "bg-transparent text-cream-soft border-gold-border",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-badge border px-3 py-1 font-rajdhani text-xs font-semibold uppercase tracking-wider",
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
