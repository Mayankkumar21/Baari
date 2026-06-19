"use client";

import * as React from "react";
import { motion } from "motion/react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { cn } from "@/lib/utils";

/**
 * Two-position pill toggle (Light · Dark) with a spring-animated thumb.
 *
 * Layout math is pixel-exact: container h-9 w-[88px] with p-1 → inner
 * content area is 80×28; each half is 40×28; the thumb is 40×28 and
 * slides between left=4 and left=44 (top=4 either way). The spring
 * gives it the shadcn-style soft bounce instead of a linear ease.
 *
 * Renders a neutral placeholder until mounted to dodge the next-themes
 * SSR/CSR mismatch.
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
      className="group relative inline-flex h-9 w-[88px] shrink-0 items-center rounded-full border border-border bg-card/60 p-1 text-[11px] font-semibold backdrop-blur transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      {/* Sliding thumb. Width is exactly half the content area; the
          spring carries it between the two slots. left-1 / top-1 anchor
          it inside the parent's padding so the edges line up perfectly
          with the Light/Dark segments. */}
      <motion.span
        aria-hidden
        initial={false}
        animate={{ x: isDark ? 40 : 0 }}
        transition={{ type: "spring", stiffness: 500, damping: 32, mass: 0.7 }}
        className="absolute left-1 top-1 h-7 w-[40px] rounded-full bg-primary/20 shadow-sm ring-1 ring-primary/40"
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
        <span className="hidden sm:inline">Light</span>
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
        <span className="hidden sm:inline">Dark</span>
      </span>
    </button>
  );
}
