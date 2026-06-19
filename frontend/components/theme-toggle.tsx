"use client";

import * as React from "react";
import { motion } from "motion/react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { cn } from "@/lib/utils";

/**
 * Two-position pill toggle (Light · Dark) with a spring-animated thumb.
 *
 * The thumb fills the parent's padding-box exactly — full inner height,
 * exactly 50% width — so its rounded-full radius matches the outer
 * pill's curvature. Previous passes used p-1 + inset-y-1 + a smaller
 * h-7 thumb, which gave the toggle a "pill within a pill" look that
 * read as misaligned. Removing the padding lets the two curves nest
 * concentrically, like a proper segmented control.
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
      className="relative inline-flex h-9 w-[96px] shrink-0 items-center overflow-hidden rounded-full border border-border bg-card/60 text-[11px] font-semibold backdrop-blur transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      {/* Thumb. Fills the padding-box vertically (inset-y-0) and is
          exactly half-width — so its rounded-full radius equals the
          parent's inner radius and the two curves nest cleanly. The
          spring drives x by 100% of its OWN width, landing on the
          opposite half's left edge with pixel precision. */}
      <motion.span
        aria-hidden
        initial={false}
        animate={{ x: isDark ? "100%" : "0%" }}
        transition={{ type: "spring", stiffness: 500, damping: 32, mass: 0.7 }}
        className="absolute inset-y-0 left-0 w-1/2 rounded-full bg-primary/20 shadow-sm ring-1 ring-inset ring-primary/40"
      />

      {/* Light segment */}
      <span
        className={cn(
          "relative z-10 flex w-1/2 items-center justify-center gap-1 transition-colors duration-200",
          !isDark ? "text-primary" : "text-muted-foreground",
        )}
      >
        <motion.span
          animate={{ rotate: isDark ? 0 : 360, scale: !isDark ? 1 : 0.85 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          className="inline-flex"
        >
          <Sun className="size-3.5" />
        </motion.span>
        <span>Light</span>
      </span>

      {/* Dark segment */}
      <span
        className={cn(
          "relative z-10 flex w-1/2 items-center justify-center gap-1 transition-colors duration-200",
          isDark ? "text-primary" : "text-muted-foreground",
        )}
      >
        <motion.span
          animate={{ rotate: isDark ? 360 : 0, scale: isDark ? 1 : 0.85 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          className="inline-flex"
        >
          <Moon className="size-3.5" />
        </motion.span>
        <span>Dark</span>
      </span>
    </button>
  );
}
