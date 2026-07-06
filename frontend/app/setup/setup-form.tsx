"use client";

import { useActionState, useRef, useState } from "react";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setupAction, type SetupState } from "./actions";
import { cn } from "@/lib/utils";

const SLOT_OPTIONS = [15, 20, 30, 45, 60] as const;
const SLOT_MIN = 5;
const SLOT_MAX = 240;

const DAYS: { key: string; label: string; defaultOpen?: string; defaultClose?: string }[] = [
  { key: "mon", label: "Monday", defaultOpen: "09:00", defaultClose: "19:00" },
  { key: "tue", label: "Tuesday", defaultOpen: "09:00", defaultClose: "19:00" },
  { key: "wed", label: "Wednesday", defaultOpen: "09:00", defaultClose: "19:00" },
  { key: "thu", label: "Thursday", defaultOpen: "09:00", defaultClose: "19:00" },
  { key: "fri", label: "Friday", defaultOpen: "09:00", defaultClose: "19:00" },
  { key: "sat", label: "Saturday", defaultOpen: "09:00", defaultClose: "14:00" },
  { key: "sun", label: "Sunday" },
];

const WEEKDAY_KEYS = ["tue", "wed", "thu", "fri"] as const;

export function SetupForm({
  initial,
}: {
  initial: {
    address?: string | null;
    slotLength: number;
    noShowThreshold: number;
    openingHours: Record<string, { open?: string; close?: string; closed?: boolean }>;
  };
}) {
  const [state, action, pending] = useActionState<SetupState, FormData>(setupAction, {});
  const formRef = useRef<HTMLFormElement>(null);

  // Custom values are allowed via the number input. The pill picker is
  // just a shortcut for the common values — pill click writes into
  // slotLength, typing overrides the pill selection.
  const [slotLength, setSlotLength] = useState<number>(initial.slotLength);

  // Allow the "copy Monday hours" button to flow values into the other
  // weekday inputs without forcing a controlled-component rewrite.
  const copyMonToWeekdays = () => {
    const form = formRef.current;
    if (!form) return;
    const monOpen = (form.elements.namedItem("mon_open") as HTMLInputElement | null)?.value ?? "";
    const monClose = (form.elements.namedItem("mon_close") as HTMLInputElement | null)?.value ?? "";
    for (const d of WEEKDAY_KEYS) {
      const openEl = form.elements.namedItem(`${d}_open`) as HTMLInputElement | null;
      const closeEl = form.elements.namedItem(`${d}_close`) as HTMLInputElement | null;
      if (openEl) openEl.value = monOpen;
      if (closeEl) closeEl.value = monClose;
    }
  };

  return (
    <form ref={formRef} action={action} className="space-y-6">
      <div className="space-y-1.5">
        <Label htmlFor="address">Address (optional)</Label>
        <Input id="address" name="address" defaultValue={initial.address ?? ""} maxLength={300} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="slot_length_min">Slot length (min)</Label>
          <div className="grid grid-cols-5 gap-1.5">
            {SLOT_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setSlotLength(opt)}
                className={cn(
                  "rounded-md border px-2 py-2 text-sm font-medium transition-all",
                  slotLength === opt
                    ? "border-primary bg-primary/10 text-foreground shadow-[0_0_0_1px_hsl(var(--primary)/0.5)]"
                    : "border-border bg-card/60 text-muted-foreground hover:border-primary/40 hover:text-foreground",
                )}
              >
                {opt}
              </button>
            ))}
          </div>
          <Input
            id="slot_length_min"
            name="slot_length_min"
            type="number"
            min={SLOT_MIN}
            max={SLOT_MAX}
            value={slotLength}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n)) setSlotLength(n);
            }}
            className="mt-1"
          />
          <p className="text-[11px] text-muted-foreground">
            Pick a common value or type your own ({SLOT_MIN}–{SLOT_MAX}).
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="no_show_threshold_min">No-show threshold (min)</Label>
          <Input
            id="no_show_threshold_min"
            name="no_show_threshold_min"
            type="number"
            min={0}
            defaultValue={initial.noShowThreshold}
          />
          <p className="text-[11px] text-muted-foreground">
            How late before we mark someone as no-show?
          </p>
        </div>
      </div>

      <div>
        <div className="flex items-end justify-between gap-2">
          <Label className="block">Opening hours</Label>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={copyMonToWeekdays}
            className="text-xs"
          >
            <Copy className="size-3" /> Copy Monday to weekdays
          </Button>
        </div>
        <div className="mt-2 space-y-2">
          {DAYS.map(({ key, label, defaultOpen, defaultClose }) => {
            const cur = initial.openingHours[key] ?? {};
            const open = cur.closed ? "" : (cur.open ?? defaultOpen ?? "");
            const close = cur.closed ? "" : (cur.close ?? defaultClose ?? "");
            return (
              <div key={key} className="grid grid-cols-[100px_1fr_1fr] items-center gap-2">
                <div className="text-sm text-muted-foreground">{label}</div>
                <Input name={`${key}_open`} type="time" defaultValue={open} />
                <Input name={`${key}_close`} type="time" defaultValue={close} />
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Leave both blank to close the day.</p>
      </div>

      {state.error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {state.error}
        </div>
      ) : null}

      <Button type="submit" variant="glow" size="lg" className="w-full" disabled={pending}>
        {pending ? "Saving…" : "Finish setup"}
      </Button>
    </form>
  );
}
