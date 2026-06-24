"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Polls server components by calling router.refresh() on an interval.
 * Used by the queue board so new bookings (from the customer app /
 * missed-call flow) and time-driven transitions (late flag, no-show
 * sweep) surface without a manual reload.
 *
 * Pauses when:
 * - tab is hidden (battery + Vercel function budget)
 * - The component is unmounted (route change)
 *
 * Resumes when the tab regains focus, with an immediate refresh so
 * the receptionist always sees the latest state when they come back.
 *
 * 15 seconds matches the customer app's live-status poll cadence —
 * keeps both sides in sync without doubling our function invocation
 * budget.
 */
export function AutoRefresh({ intervalMs = 15_000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    let id: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (id != null) return;
      id = setInterval(() => router.refresh(), intervalMs);
    };
    const stop = () => {
      if (id != null) {
        clearInterval(id);
        id = null;
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        router.refresh(); // immediate catch-up on return
        start();
      } else {
        stop();
      }
    };

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router, intervalMs]);

  return null;
}
