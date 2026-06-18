"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setupAction, type SetupState } from "./actions";

const DAYS: { key: string; label: string; defaultOpen?: string; defaultClose?: string }[] = [
  { key: "mon", label: "Monday", defaultOpen: "09:00", defaultClose: "19:00" },
  { key: "tue", label: "Tuesday", defaultOpen: "09:00", defaultClose: "19:00" },
  { key: "wed", label: "Wednesday", defaultOpen: "09:00", defaultClose: "19:00" },
  { key: "thu", label: "Thursday", defaultOpen: "09:00", defaultClose: "19:00" },
  { key: "fri", label: "Friday", defaultOpen: "09:00", defaultClose: "19:00" },
  { key: "sat", label: "Saturday", defaultOpen: "09:00", defaultClose: "14:00" },
  { key: "sun", label: "Sunday" },
];

export function SetupForm({ initial }: { initial: { address?: string | null; slotLength: number; noShowThreshold: number; openingHours: Record<string, { open?: string; close?: string; closed?: boolean }> } }) {
  const [state, action, pending] = useActionState<SetupState, FormData>(setupAction, {});
  return (
    <form action={action} className="space-y-6">
      <div className="space-y-1.5">
        <Label htmlFor="address">Address (optional)</Label>
        <Input id="address" name="address" defaultValue={initial.address ?? ""} maxLength={300} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="slot_length_min">Slot length (minutes)</Label>
          <Input id="slot_length_min" name="slot_length_min" type="number" min={5} max={240} defaultValue={initial.slotLength} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="no_show_threshold_min">No-show threshold (minutes)</Label>
          <Input id="no_show_threshold_min" name="no_show_threshold_min" type="number" min={0} defaultValue={initial.noShowThreshold} />
        </div>
      </div>

      <div>
        <Label className="mb-2 block">Opening hours</Label>
        <div className="space-y-2">
          {DAYS.map(({ key, label, defaultOpen, defaultClose }) => {
            const cur = initial.openingHours[key] ?? {};
            const open = cur.closed ? "" : cur.open ?? defaultOpen ?? "";
            const close = cur.closed ? "" : cur.close ?? defaultClose ?? "";
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
