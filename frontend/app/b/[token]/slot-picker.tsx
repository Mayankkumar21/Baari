"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { fmtTime } from "@/lib/time";
import { cn } from "@/lib/utils";

type Day = "today" | "tomorrow";

export function SlotPicker({
  token,
  lang,
  todaySlots,
  tomorrowSlots,
  todayLabel,
  tomorrowLabel,
  pickTimeLabel,
  continueLabel,
  fullyBookedLabel,
  seeTomorrowLabel,
  tz,
}: {
  token: string;
  lang: "en" | "hi";
  todaySlots: string[];
  tomorrowSlots: string[];
  todayLabel: string;
  tomorrowLabel: string;
  pickTimeLabel: string;
  continueLabel: string;
  fullyBookedLabel: string;
  seeTomorrowLabel: string;
  tz: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const initialDay: Day = todaySlots.length > 0 ? "today" : "tomorrow";
  const [day, setDay] = useState<Day>(initialDay);
  const [slot, setSlot] = useState<string | null>(null);

  const slots = useMemo(
    () => (day === "today" ? todaySlots : tomorrowSlots),
    [day, todaySlots, tomorrowSlots],
  );

  const showSegmented = todaySlots.length > 0 && tomorrowSlots.length > 0;
  const todayEmpty = todaySlots.length === 0;

  const handleContinue = () => {
    if (!slot) return;
    startTransition(() => {
      const params = new URLSearchParams();
      params.set("slot", slot);
      if (lang === "hi") params.set("lang", "hi");
      router.push(`/b/${token}/details?${params.toString()}`);
    });
  };

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between">
        <h2 className="text-base font-semibold">{pickTimeLabel}</h2>

        {showSegmented ? (
          <div className="inline-flex rounded-full border border-border bg-card/50 p-0.5 text-[11px] font-semibold">
            <button
              type="button"
              onClick={() => {
                setDay("today");
                setSlot(null);
              }}
              className={cn(
                "rounded-full px-3 py-1 transition-colors",
                day === "today" ? "bg-primary text-primary-foreground" : "text-muted-foreground",
              )}
            >
              {todayLabel}
            </button>
            <button
              type="button"
              onClick={() => {
                setDay("tomorrow");
                setSlot(null);
              }}
              className={cn(
                "rounded-full px-3 py-1 transition-colors",
                day === "tomorrow" ? "bg-primary text-primary-foreground" : "text-muted-foreground",
              )}
            >
              {tomorrowLabel}
            </button>
          </div>
        ) : null}
      </div>

      {todayEmpty && day === "tomorrow" ? (
        <p className="rounded-lg border border-dashed border-border bg-card/40 px-3 py-2 text-center text-xs text-muted-foreground">
          {fullyBookedLabel} {seeTomorrowLabel.toLowerCase()} ↓
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        {slots.map((iso) => {
          const selected = slot === iso;
          return (
            <button
              key={iso}
              type="button"
              onClick={() => setSlot(iso)}
              className={cn(
                "rounded-full border px-3 py-3 text-sm font-semibold tabular-nums transition-all",
                selected
                  ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/30"
                  : "border-border bg-card/60 text-foreground hover:border-primary/50",
              )}
            >
              {fmtTime(iso, tz)}
            </button>
          );
        })}
      </div>

      {/* Bottom sticky CTA */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 px-5 py-3 backdrop-blur">
        <div className="mx-auto max-w-md">
          <button
            type="button"
            onClick={handleContinue}
            disabled={!slot || pending}
            className={cn(
              "inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold transition-all",
              !slot || pending
                ? "cursor-not-allowed bg-secondary text-muted-foreground"
                : "bg-primary text-primary-foreground shadow-lg shadow-primary/30 active:scale-[0.98]",
            )}
          >
            {pending ? "…" : `${continueLabel} →`}
          </button>
        </div>
      </div>
    </section>
  );
}
