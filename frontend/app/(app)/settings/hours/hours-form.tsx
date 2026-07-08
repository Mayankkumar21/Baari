"use client";

import { useActionState, useRef, useState } from "react";
import { Copy, Phone, Plus, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { saveHours, type HoursState } from "../actions";

type Day = {
  key: string;
  label: string;
  defaultOpen?: string;
  defaultClose?: string;
};

const DAYS: Day[] = [
  { key: "mon", label: "Monday", defaultOpen: "09:00", defaultClose: "19:00" },
  { key: "tue", label: "Tuesday", defaultOpen: "09:00", defaultClose: "19:00" },
  { key: "wed", label: "Wednesday", defaultOpen: "09:00", defaultClose: "19:00" },
  { key: "thu", label: "Thursday", defaultOpen: "09:00", defaultClose: "19:00" },
  { key: "fri", label: "Friday", defaultOpen: "09:00", defaultClose: "19:00" },
  { key: "sat", label: "Saturday", defaultOpen: "09:00", defaultClose: "14:00" },
  { key: "sun", label: "Sunday" },
];

const WEEKDAYS = ["tue", "wed", "thu", "fri"] as const;
const NON_MON = ["tue", "wed", "thu", "fri", "sat", "sun"] as const;

type HoursDoc = Record<
  string,
  { open?: string; close?: string; closed?: boolean; open2?: string; close2?: string }
>;

export function HoursForm({ initial }: { initial: HoursDoc }) {
  const [state, action, pending] = useActionState<HoursState, FormData>(saveHours, {});
  const formRef = useRef<HTMLFormElement>(null);

  // Per-day "break enabled" toggle, seeded from existing open2/close2.
  const [hasBreak, setHasBreak] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      DAYS.map((d) => [
        d.key,
        Boolean(initial[d.key]?.open2 && initial[d.key]?.close2),
      ]),
    ),
  );

  const copyMon = (toKeys: readonly string[]) => {
    const form = formRef.current;
    if (!form) return;
    const monOpen = (form.elements.namedItem("mon_open") as HTMLInputElement | null)?.value ?? "";
    const monClose = (form.elements.namedItem("mon_close") as HTMLInputElement | null)?.value ?? "";
    const monOpen2 = (form.elements.namedItem("mon_open2") as HTMLInputElement | null)?.value ?? "";
    const monClose2 = (form.elements.namedItem("mon_close2") as HTMLInputElement | null)?.value ?? "";
    for (const d of toKeys) {
      (form.elements.namedItem(`${d}_open`) as HTMLInputElement | null)?.setAttribute("value", monOpen);
      (form.elements.namedItem(`${d}_close`) as HTMLInputElement | null)?.setAttribute("value", monClose);
      // Also set the live `.value` so it shows immediately.
      const oEl = form.elements.namedItem(`${d}_open`) as HTMLInputElement | null;
      const cEl = form.elements.namedItem(`${d}_close`) as HTMLInputElement | null;
      if (oEl) oEl.value = monOpen;
      if (cEl) cEl.value = monClose;
      // Break range: enable if Monday has one, otherwise disable.
      if (monOpen2 && monClose2) {
        setHasBreak((prev) => ({ ...prev, [d]: true }));
        // The break inputs may not be rendered yet; sync after render.
        requestAnimationFrame(() => {
          const o2 = form.elements.namedItem(`${d}_open2`) as HTMLInputElement | null;
          const c2 = form.elements.namedItem(`${d}_close2`) as HTMLInputElement | null;
          if (o2) o2.value = monOpen2;
          if (c2) c2.value = monClose2;
        });
      } else {
        setHasBreak((prev) => ({ ...prev, [d]: false }));
      }
    }
  };

  return (
    <form ref={formRef} action={action} className="space-y-5">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => copyMon(WEEKDAYS)}
          className="text-xs"
        >
          <Copy className="size-3" /> Copy Monday to weekdays
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => copyMon(NON_MON)}
          className="text-xs"
        >
          <Copy className="size-3" /> Copy Monday to all
        </Button>
      </div>

      <div className="space-y-3">
        {DAYS.map(({ key, label, defaultOpen, defaultClose }) => {
          const cur = initial[key] ?? {};
          const initiallyClosed = cur.closed || (!cur.open && !defaultOpen);
          const open = cur.closed ? "" : (cur.open ?? defaultOpen ?? "");
          const close = cur.closed ? "" : (cur.close ?? defaultClose ?? "");
          const open2 = cur.open2 ?? "";
          const close2 = cur.close2 ?? "";
          const showBreak = hasBreak[key];
          return (
            <div
              key={key}
              className={cn(
                "rounded-lg border p-3 transition-all",
                initiallyClosed && !showBreak && !open
                  ? "border-border bg-card/40"
                  : "border-border bg-card/60",
              )}
            >
              <div className="flex flex-wrap items-center gap-3">
                <div className="w-24 text-sm font-medium">{label}</div>
                <div className="flex flex-1 flex-wrap items-center gap-2">
                  <Input
                    name={`${key}_open`}
                    type="time"
                    defaultValue={open}
                    className="h-9 max-w-[120px]"
                  />
                  <span className="text-xs text-muted-foreground">→</span>
                  <Input
                    name={`${key}_close`}
                    type="time"
                    defaultValue={close}
                    className="h-9 max-w-[120px]"
                  />
                </div>
                {!showBreak ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setHasBreak((prev) => ({ ...prev, [key]: true }))
                    }
                    className="text-xs"
                  >
                    <Plus className="size-3" /> Add break
                  </Button>
                ) : null}
              </div>
              {showBreak ? (
                <div className="mt-2 flex flex-wrap items-center gap-2 pl-[100px]">
                  <span className="text-[11px] text-muted-foreground">Afternoon block:</span>
                  <Input
                    name={`${key}_open2`}
                    type="time"
                    defaultValue={open2}
                    className="h-9 max-w-[120px]"
                  />
                  <span className="text-xs text-muted-foreground">→</span>
                  <Input
                    name={`${key}_close2`}
                    type="time"
                    defaultValue={close2}
                    className="h-9 max-w-[120px]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setHasBreak((prev) => ({ ...prev, [key]: false }));
                      const o = formRef.current?.elements.namedItem(
                        `${key}_open2`,
                      ) as HTMLInputElement | null;
                      const c = formRef.current?.elements.namedItem(
                        `${key}_close2`,
                      ) as HTMLInputElement | null;
                      if (o) o.value = "";
                      if (c) c.value = "";
                    }}
                    className="text-muted-foreground hover:text-destructive"
                    title="Remove break"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        Leave both blank for a day off. Use the break range for split shifts
        (e.g. lunch close).
      </p>

      {state.error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {state.error}
        </div>
      ) : null}
      {state.ok ? (
        <div className="rounded-md border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-600 dark:text-emerald-300">
          Saved.
        </div>
      ) : null}

      {/* Affected-bookings callout. Baari deliberately does NOT quietly
          cancel these — the clinic wouldn't know, and each patient
          would show up to a closed door. Instead the receptionist gets
          a call-list; each row is a tap-to-dial link on mobile. */}
      {state.ok && state.affected && state.affected.length > 0 ? (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
          <div className="text-xs font-semibold text-amber-700 dark:text-amber-300">
            {state.affected.length} booking{state.affected.length === 1 ? "" : "s"} now
            outside your hours — please call and reschedule
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            We didn't cancel these automatically. Each patient still expects
            their slot; give them a heads-up and offer a new time.
          </p>
          <ul className="mt-2 space-y-1.5">
            {state.affected.map((b) => (
              <li
                key={b.bookingId}
                className="flex flex-wrap items-center gap-2 rounded border border-amber-500/20 bg-background/60 px-2 py-1.5 text-xs"
              >
                <div className="flex-1 min-w-0">
                  <div className="truncate font-medium">{b.patientName}</div>
                  <div className="text-[10px] text-muted-foreground">{b.dateLabel}</div>
                </div>
                {b.mobile ? (
                  <a
                    href={`tel:${b.mobile}`}
                    className="inline-flex items-center gap-1 rounded border border-border bg-card px-2 py-0.5 text-[11px] font-medium hover:border-primary/40 hover:text-primary"
                  >
                    <Phone className="size-3" /> {b.mobile}
                  </a>
                ) : (
                  <span className="text-[11px] text-muted-foreground">no phone</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Button type="submit" variant="glow" disabled={pending}>
        <Save className="size-4" /> {pending ? "Saving…" : "Save hours"}
      </Button>
    </form>
  );
}
