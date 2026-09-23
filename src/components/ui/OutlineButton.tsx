"use client";

import { forwardRef, ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface OutlineButtonProps {
  children?: ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  onClick?: () => void;
}

export const OutlineButton = forwardRef<HTMLButtonElement, OutlineButtonProps>(
  (
    {
      children,
      className,
      size = "md",
      fullWidth,
      disabled,
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
        whileHover={{ scale: disabled ? 1 : 1.02 }}
        disabled={disabled}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-input border border-gold-border bg-transparent font-rajdhani font-semibold tracking-wide text-gold transition-all hover:border-gold hover:bg-gold-faint hover:shadow-gold-sm disabled:cursor-not-allowed disabled:opacity-50",
          sizes[size],
          fullWidth && "w-full",
          className
        )}
      >
        {children}
      </motion.button>
    );
  }
);

OutlineButton.displayName = "OutlineButton";
