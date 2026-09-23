import { cn } from "@/lib/utils";
import type { BloodGroup } from "@/lib/types";

interface BloodGroupBadgeProps {
  bloodGroup: BloodGroup | string;
  size?: "sm" | "md" | "lg" | "xl" | "emergency";
  className?: string;
}

export function BloodGroupBadge({
  bloodGroup,
  size = "md",
  className,
}: BloodGroupBadgeProps) {
  const sizes = {
    sm: "h-10 w-10 text-sm",
    md: "h-14 w-14 text-lg",
    lg: "h-20 w-20 text-2xl",
    xl: "h-28 w-28 text-[3rem]",
    emergency: "min-h-[5.5rem] min-w-[5.5rem] px-4 text-[72px] leading-none",
  };

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-danger font-mono font-bold text-white shadow-[0_0_30px_rgba(229,57,53,0.4)]",
        sizes[size],
        className
      )}
      aria-label={`Blood group ${bloodGroup}`}
    >
      {bloodGroup}
    </div>
  );
}
