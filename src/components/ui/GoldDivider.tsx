import { cn } from "@/lib/utils";

interface GoldDividerProps {
  className?: string;
}

export function GoldDivider({ className }: GoldDividerProps) {
  return (
    <div
      className={cn("flex w-full items-center gap-4", className)}
      role="separator"
    >
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold-border to-transparent" />
      <div className="h-1.5 w-1.5 rounded-full bg-gold" />
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold-border to-transparent" />
    </div>
  );
}
