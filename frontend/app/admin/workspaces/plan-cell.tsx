"use client";

// Admin plan-grant control. Opens a small popover per workspace row
// with three tier buttons + an optional expiry date. Writes go through
// the server action defined in ./plan-actions.ts.

import { useState, useTransition } from "react";
import { ChevronDown } from "lucide-react";
import { grantPlanAction } from "./plan-actions";

type PlanTier = "free" | "growth" | "pro";

export function PlanCell({
  clinicId,
  currentPlan,
  effectivePlan,
  trialEndsAt,
  planSource,
}: {
  clinicId: number;
  currentPlan: string;
  effectivePlan: string;
  trialEndsAt: string | null;
  planSource: string;
}) {
  const [open, setOpen] = useState(false);
  const [tier, setTier] = useState<PlanTier>((effectivePlan as PlanTier) ?? "free");
  const [expiry, setExpiry] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    start(async () => {
      const res = await grantPlanAction(clinicId, tier, expiry.trim() || null);
      if (!res.ok) setError(res.error);
      else setOpen(false);
    });
  };

  const pillTone =
    effectivePlan === "pro"
      ? "border-primary/40 bg-primary/10 text-primary"
      : effectivePlan === "growth"
        ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
        : "border-border bg-secondary/60 text-muted-foreground";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${pillTone}`}
        title={`base=${currentPlan}, source=${planSource}${trialEndsAt ? `, trial ends ${trialEndsAt.slice(0, 10)}` : ""}`}
      >
        {effectivePlan}
        <ChevronDown className="size-2.5 opacity-60" />
      </button>
      {open ? (
        <div
          className="absolute right-0 top-full z-40 mt-2 w-64 rounded-lg border border-border bg-card/95 p-3 text-left shadow-xl backdrop-blur"
          onMouseLeave={() => setOpen(false)}
        >
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Grant plan
          </div>
          <div className="mb-2 flex gap-1">
            {(["free", "growth", "pro"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setTier(k)}
                className={
                  "flex-1 rounded-md border px-2 py-1 text-xs font-medium capitalize " +
                  (tier === k
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border bg-card/60 text-muted-foreground hover:border-primary/40")
                }
              >
                {k}
              </button>
            ))}
          </div>
          <label className="mt-2 block text-[11px] text-muted-foreground">
            Expires <span className="opacity-60">(optional; leave blank for permanent)</span>
            <input
              type="date"
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
              className="mt-1 h-8 w-full rounded-md border border-border bg-secondary/60 px-2 text-xs"
            />
          </label>
          {error ? (
            <div className="mt-2 text-[11px] text-rose-500">{error}</div>
          ) : null}
          <div className="mt-3 flex items-center justify-end gap-1.5">
            <button
              type="button"
              className="rounded-md border border-border px-2 py-1 text-xs hover:bg-secondary/60"
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={submit}
              className="rounded-md border border-primary bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "Saving…" : "Grant"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
