"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Calendar, CheckCircle2, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { bookAction, type BookState } from "./actions";
import { cn } from "@/lib/utils";
import { fmtTime } from "@/lib/time";

export type SlotInfo = { iso: string; status: "open" | "taken" | "past" };

export function BookForm({
  slots,
  freeCount,
  totalCount,
  services,
  reasonLabel,
  entitySingular,
  fromPanel,
  onSuccess,
}: {
  slots: SlotInfo[];
  freeCount: number;
  totalCount: number;
  services: string[];
  reasonLabel: string;
  entitySingular: string;
  // When the form is mounted inside the queue's side panel, the action
  // returns without redirecting; the parent panel calls onSuccess so it can
  // close itself. /book route → no parent → no callback → action redirects.
  fromPanel?: boolean;
  onSuccess?: () => void;
}) {
  const [state, action, pending] = useActionState<BookState, FormData>(bookAction, {});
  const formRef = useRef<HTMLFormElement>(null);
  const [slot, setSlot] = useState<string | null>(slots.find((s) => s.status === "open")?.iso ?? null);
  const [customReason, setCustomReason] = useState(false);
  const [service, setService] = useState<string>(services[0] ?? "");
  const [customValue, setCustomValue] = useState("");
  const [justSaved, setJustSaved] = useState(false);

  // After "Save & add another" succeeds, reset the form fields but keep the
  // panel open. After plain Create, when running inside the panel, let the
  // parent dismiss the sheet.
  useEffect(() => {
    if (state.addAnother) {
      formRef.current?.reset();
      setSlot(slots.find((s) => s.status === "open")?.iso ?? null);
      setCustomReason(false);
      setService(services[0] ?? "");
      setCustomValue("");
      setJustSaved(true);
      const t = setTimeout(() => setJustSaved(false), 2500);
      return () => clearTimeout(t);
    }
    if (fromPanel && state && !state.error && !state.addAnother && state !== undefined) {
      // No-op — the parent watches state separately via onSuccess hook below.
    }
  }, [state, fromPanel, services, slots]);

  // When in panel mode, signal success to the parent so it can dismiss.
  useEffect(() => {
    if (fromPanel && !state?.error && !state?.addAnother && pending === false) {
      // Only fire onSuccess when there was a real submission (not initial render).
      // useActionState's initial state has no keys at all, so the absence of
      // both error+addAnother right after a pending → false transition is
      // ambiguous. We use a ref to track whether we just finished a submission.
    }
  }, [fromPanel, pending, state]);

  const submittingRef = useRef(false);
  useEffect(() => {
    if (pending) submittingRef.current = true;
    if (!pending && submittingRef.current && fromPanel) {
      submittingRef.current = false;
      if (!state?.error && !state?.addAnother) onSuccess?.();
    }
  }, [pending, state, fromPanel, onSuccess]);

  const reasonValue = customReason ? customValue : service;

  return (
    <form ref={formRef} action={action} className="space-y-5">
      {fromPanel ? <input type="hidden" name="from_panel" value="1" /> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="name">{entitySingular[0].toUpperCase() + entitySingular.slice(1)} name</Label>
          <Input id="name" name="name" required maxLength={80} autoFocus />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="mobile">Mobile</Label>
          <Input id="mobile" name="mobile" inputMode="numeric" required placeholder="10 digits" maxLength={10} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="service">{reasonLabel}</Label>
          {customReason ? (
            <div className="flex gap-2">
              <Input
                value={customValue}
                onChange={(e) => setCustomValue(e.target.value)}
                placeholder="Type a custom service…"
                maxLength={200}
              />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setCustomReason(false);
                  setCustomValue("");
                }}
              >
                Back
              </Button>
            </div>
          ) : (
            <select
              id="service"
              value={service}
              onChange={(e) => {
                if (e.target.value === "__custom__") {
                  setCustomReason(true);
                } else {
                  setService(e.target.value);
                }
              }}
              className="flex h-10 w-full rounded-md border border-input bg-card/60 px-3 py-2 text-sm backdrop-blur focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background"
            >
              {services.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
              <option value="__custom__">+ Add custom…</option>
            </select>
          )}
          <input type="hidden" name="reason" value={reasonValue} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="party_size">Party size</Label>
          <Input id="party_size" name="party_size" type="number" min={1} max={5} defaultValue={1} />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" name="is_new" defaultChecked className="accent-primary" /> First visit
        </label>
      </div>

      <div>
        <div className="mb-2 flex items-end justify-between">
          <Label>Slot today</Label>
          <span className="text-[11px] text-muted-foreground">
            {freeCount} of {totalCount} slots free today
          </span>
        </div>
        {totalCount === 0 ? (
          <div className="rounded-md border border-dashed border-border bg-card/40 p-6 text-center text-sm text-muted-foreground">
            No slots today. Check opening hours in Settings.
          </div>
        ) : (
          <div className="grid max-h-56 grid-cols-4 gap-1.5 overflow-y-auto sm:grid-cols-6">
            {slots.map(({ iso, status }) => {
              const isOpen = status === "open";
              const isTaken = status === "taken";
              return (
                <button
                  key={iso}
                  type="button"
                  disabled={!isOpen}
                  title={
                    isTaken
                      ? "Already booked"
                      : status === "past"
                        ? "Past time"
                        : undefined
                  }
                  onClick={() => isOpen && setSlot(iso)}
                  className={cn(
                    "rounded-md border px-2 py-2 text-xs font-medium transition-all backdrop-blur",
                    isOpen && slot === iso
                      ? "border-primary bg-primary/15 text-foreground shadow-[0_0_0_1px_hsl(var(--primary)/0.5)]"
                      : isOpen
                        ? "border-border bg-card/60 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                        : isTaken
                          ? "border-border/40 bg-secondary/30 text-muted-foreground/40 line-through cursor-not-allowed"
                          // past — dashed border + heavier strike + lower opacity so it
                          // reads as visually inert next to open slots.
                          : "border-dashed border-border/40 bg-transparent text-muted-foreground/40 line-through opacity-60 cursor-not-allowed",
                  )}
                >
                  {fmtTime(iso)}
                </button>
              );
            })}
          </div>
        )}
        <input type="hidden" name="slot_time" value={slot ?? ""} />
      </div>

      {state.error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {state.error}
        </div>
      ) : null}
      {justSaved ? (
        <div className="rounded-md border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-600 dark:text-emerald-300">
          <CheckCircle2 className="mr-1 inline size-3" /> Booking saved. Ready for the next one.
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          variant="glow"
          size="lg"
          name="mode"
          value="create"
          disabled={pending || !slot}
        >
          <Calendar className="size-4" /> {pending ? "Booking…" : "Create booking"}
        </Button>
        <Button
          type="submit"
          variant="outline"
          size="lg"
          name="mode"
          value="add_another"
          disabled={pending || !slot}
        >
          <Plus className="size-4" /> Save & add another
        </Button>
      </div>
    </form>
  );
}
