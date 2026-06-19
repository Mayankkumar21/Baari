"use client";

import { useActionState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveSettings, type SettingsState } from "./actions";

const TYPES = [
  { key: "clinic", label: "Clinic" },
  { key: "dental", label: "Dental" },
  { key: "salon", label: "Salon" },
  { key: "spa", label: "Spa" },
  { key: "vet", label: "Vet" },
  { key: "other", label: "Other" },
];

const DAYS: { key: string; label: string; defaultOpen?: string; defaultClose?: string }[] = [
  { key: "mon", label: "Monday", defaultOpen: "09:00", defaultClose: "19:00" },
  { key: "tue", label: "Tuesday", defaultOpen: "09:00", defaultClose: "19:00" },
  { key: "wed", label: "Wednesday", defaultOpen: "09:00", defaultClose: "19:00" },
  { key: "thu", label: "Thursday", defaultOpen: "09:00", defaultClose: "19:00" },
  { key: "fri", label: "Friday", defaultOpen: "09:00", defaultClose: "19:00" },
  { key: "sat", label: "Saturday", defaultOpen: "09:00", defaultClose: "14:00" },
  { key: "sun", label: "Sunday" },
];

export function SettingsForm({
  initial,
}: {
  initial: {
    name: string;
    tenantType: string;
    slot: number;
    noShow: number;
    openingHours: Record<string, { open?: string; close?: string; closed?: boolean }>;
  };
}) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(saveSettings, {});
  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="hours_present" value="1" />

      <div className="space-y-1.5">
        <Label htmlFor="name">Workspace name</Label>
        <Input id="name" name="name" defaultValue={initial.name} maxLength={120} required />
      </div>

      <div className="space-y-1.5">
        <Label>Business type</Label>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {TYPES.map((t) => (
            <label key={t.key} className="cursor-pointer">
              <input
                type="radio"
                name="tenant_type"
                value={t.key}
                defaultChecked={initial.tenantType === t.key}
                className="peer sr-only"
              />
              <div className="rounded-md border border-border bg-card/60 px-3 py-2 text-center text-xs font-medium text-muted-foreground transition-all peer-checked:border-primary peer-checked:bg-primary/10 peer-checked:text-foreground peer-checked:shadow-[0_0_0_1px_hsl(var(--primary)/0.5)]">
                {t.label}
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="slot_length_min">Slot length (min)</Label>
          <Input
            id="slot_length_min"
            name="slot_length_min"
            type="number"
            min={5}
            max={240}
            defaultValue={initial.slot}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="no_show_threshold_min">No-show threshold (min)</Label>
          <Input
            id="no_show_threshold_min"
            name="no_show_threshold_min"
            type="number"
            min={0}
            defaultValue={initial.noShow}
          />
        </div>
      </div>

      <div>
        <Label className="mb-2 block">Opening hours</Label>
        <div className="space-y-2">
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
        <p className="mt-2 text-xs text-muted-foreground">
          Leave both blank to close the day.
        </p>
      </div>

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

      <Button type="submit" variant="glow" disabled={pending}>
        <Save className="size-4" /> {pending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
