"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { cn } from "@/lib/utils";

/**
 * Two-position pill toggle (Light · Dark) with a sliding thumb. Reads as a
 * real interactive control rather than a bare icon button — the previous
 * lone Moon/Sun glyph was easy to miss.
 *
 * Renders a neutral placeholder until mounted to avoid the next-themes
 * hydration mismatch.
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
      className="group relative inline-flex h-9 w-[88px] items-center rounded-full border border-border bg-card/60 p-1 text-[11px] font-semibold backdrop-blur transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      {/* Sliding thumb */}
      <span
        aria-hidden
        className={cn(
          "absolute top-1 h-7 w-[40px] rounded-full bg-primary/20 shadow-sm ring-1 ring-primary/40 transition-transform duration-200 ease-out",
          isDark ? "translate-x-[40px]" : "translate-x-0",
        )}
      />

      {/* Light segment */}
      <span
        className={cn(
          "relative z-10 flex w-1/2 items-center justify-center gap-1 transition-colors",
          !isDark ? "text-primary" : "text-muted-foreground",
        )}
      >
        <Sun className="size-3.5" />
        <span className="hidden sm:inline">Light</span>
      </span>

      {/* Dark segment */}
      <span
        className={cn(
          "relative z-10 flex w-1/2 items-center justify-center gap-1 transition-colors",
          isDark ? "text-primary" : "text-muted-foreground",
        )}
      >
        <Moon className="size-3.5" />
        <span className="hidden sm:inline">Dark</span>
      </span>
    </button>
  );
}
