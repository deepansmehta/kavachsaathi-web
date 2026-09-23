"use client";

import { forwardRef, ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface GoldCardProps {
  children?: ReactNode;
  className?: string;
  hover?: boolean;
  glow?: boolean;
  padding?: "sm" | "md" | "lg";
}

export const GoldCard = forwardRef<HTMLDivElement, GoldCardProps>(
  (
    {
      children,
      className,
      hover = true,
      glow = false,
      padding = "md",
    },
    ref
  ) => {
    const paddings = {
      sm: "p-4",
      md: "p-6",
      lg: "p-8",
    };

    return (
      <motion.div
        ref={ref}
        whileHover={
          hover
            ? { scale: 1.02, boxShadow: "0 0 24px rgba(212,175,55,0.2)" }
            : undefined
        }
        transition={{ duration: 0.2 }}
        className={cn(
          "rounded-card border border-gold-border bg-kavach-s1 grid-pattern",
          paddings[padding],
          glow && "shadow-gold-glow",
          className
        )}
      >
        {children}
      </motion.div>
    );
  }
);

GoldCard.displayName = "GoldCard";
