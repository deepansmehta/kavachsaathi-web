"use client";

import { forwardRef, ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface GoldButtonProps {
  children?: ReactNode;
  className?: string;
  loading?: boolean;
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  onClick?: () => void;
}

export const GoldButton = forwardRef<HTMLButtonElement, GoldButtonProps>(
  (
    {
      children,
      className,
      loading,
      disabled,
      size = "md",
      fullWidth,
      type = "button",
      onClick,
    },
    ref
  ) => {
    const sizes = {
      sm: "px-4 py-2 text-sm",
      md: "px-6 py-3 text-base",
      lg: "px-8 py-4 text-lg",
    };

    return (
      <motion.button
        ref={ref}
        type={type}
        onClick={onClick}
        whileTap={{ scale: 0.97 }}
        whileHover={{ scale: disabled || loading ? 1 : 1.02 }}
        disabled={disabled || loading}
        className={cn(
          "relative inline-flex items-center justify-center gap-2 rounded-input font-rajdhani font-semibold tracking-wide text-kavach-black gold-gradient shadow-gold-sm transition-shadow hover:shadow-gold-glow disabled:cursor-not-allowed disabled:opacity-50",
          sizes[size],
          fullWidth && "w-full",
          className
        )}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {children}
      </motion.button>
    );
  }
);

GoldButton.displayName = "GoldButton";
