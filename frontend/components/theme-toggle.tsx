"use client";

import * as React from "react";
import { motion } from "motion/react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { cn } from "@/lib/utils";

/**
 * Two-position pill toggle with sun/moon icons — no text.
 *
 * The thumb fills the parent's padding-box (inset-y-0, w-1/2) so its
 * rounded-full radius nests concentrically with the outer pill. The
 * spring animates x by 100% of the thumb's own width, landing on the
 * opposite half's left edge with pixel precision.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="relative inline-flex h-9 w-[64px] shrink-0 items-center overflow-hidden rounded-full border border-border bg-card/60 backdrop-blur transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <motion.span
        aria-hidden
        initial={false}
        animate={{ x: isDark ? "100%" : "0%" }}
        transition={{ type: "spring", stiffness: 500, damping: 32, mass: 0.7 }}
        className="absolute inset-y-0 left-0 w-1/2 rounded-full bg-primary/20 shadow-sm ring-1 ring-inset ring-primary/40"
      />

      <span
        className={cn(
          "relative z-10 flex w-1/2 items-center justify-center transition-colors duration-200",
          !isDark ? "text-primary" : "text-muted-foreground",
        )}
      >
        <motion.span
          animate={{ rotate: isDark ? 0 : 360, scale: !isDark ? 1 : 0.85 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          className="inline-flex"
        >
          <Sun className="size-4" />
        </motion.span>
      </span>

      <span
        className={cn(
          "relative z-10 flex w-1/2 items-center justify-center transition-colors duration-200",
          isDark ? "text-primary" : "text-muted-foreground",
        )}
      >
        <motion.span
          animate={{ rotate: isDark ? 360 : 0, scale: isDark ? 1 : 0.85 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          className="inline-flex"
        >
          <Moon className="size-4" />
        </motion.span>
      </span>
    </button>
  );
}
