"use client";

// Small header pill that shows the workspace's current plan.
//
// Three visual states, ordered by urgency:
//   1. Trial with < 15 days left → amber "Trial · Nd left" — nudges
//      the owner to decide before auto-downgrade to Free.
//   2. Trial with more time     → primary "Trial · Nd left" — same
//      information, calmer palette.
//   3. Free / Growth / Pro      → neutral pill with just the tier.
//
// Click → /pricing so the owner can see what they'd change TO.

import Link from "next/link";
import { Sparkles } from "lucide-react";

export function PlanBadge({
  plan,
  trialDaysLeft,
}: {
  plan: "free" | "growth" | "pro";
  trialDaysLeft: number; // 0 when not on trial
}) {
  const onTrial = trialDaysLeft > 0;

  if (onTrial) {
    const urgent = trialDaysLeft <= 15;
    const cls = urgent
      ? "border-amber-400/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
      : "border-primary/40 bg-primary/10 text-primary";
    return (
      <Link
        href="/pricing"
        title={`Baari Pro trial — ${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"} remaining. Click to see plans.`}
        className={`hidden sm:inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest hover:opacity-90 ${cls}`}
      >
        <Sparkles className="size-2.5" /> Trial · {trialDaysLeft}d
      </Link>
    );
  }

  const tone =
    plan === "pro"
      ? "border-primary/40 bg-primary/10 text-primary"
      : plan === "growth"
        ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
        : "border-border bg-secondary/60 text-muted-foreground";
  return (
    <Link
      href="/pricing"
      title={`You're on the ${plan} plan. Click to see plans.`}
      className={`hidden sm:inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest capitalize hover:opacity-90 ${tone}`}
    >
      {plan}
    </Link>
  );
}
