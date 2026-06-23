"use client";

import { useActionState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveWorkspace, type WorkspaceState } from "../actions";

const TYPES = [
  { key: "clinic", label: "Clinic" },
  { key: "dental", label: "Dental" },
  { key: "salon", label: "Salon" },
  { key: "spa", label: "Spa" },
  { key: "vet", label: "Vet" },
  { key: "other", label: "Other" },
];

export function WorkspaceForm({
  initial,
}: {
  initial: {
    name: string;
    tenantType: string;
    slot: number;
    noShow: number;
    address: string;
    phone: string;
    city: string;
    slug: string;
    publicListing: boolean;
  };
}) {
  const [state, action, pending] = useActionState<WorkspaceState, FormData>(
    saveWorkspace,
    {},
  );
  return (
    <form action={action} className="space-y-5">
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

      <div className="space-y-1.5">
        <Label htmlFor="address">Address (optional)</Label>
        <Input
          id="address"
          name="address"
          defaultValue={initial.address}
          maxLength={300}
          placeholder="Where customers can find you"
        />
        <p className="text-[11px] text-muted-foreground">
          Shown on booking confirmations.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone (for customers)</Label>
          <Input
            id="phone"
            name="phone"
            defaultValue={initial.phone}
            maxLength={15}
            inputMode="numeric"
            placeholder="10 digits"
          />
          <p className="text-[11px] text-muted-foreground">
            Tap-to-call from your booking page + the customer app.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="city">City</Label>
          <Input
            id="city"
            name="city"
            defaultValue={initial.city}
            maxLength={60}
            placeholder="e.g. Indore"
          />
          <p className="text-[11px] text-muted-foreground">
            Helps customers nearby find you.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card/40 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="text-sm font-semibold">Show on Baari app</div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              When enabled, customers using the Baari app can find your
              business by name or by your Baari code{" "}
              <span className="font-mono font-semibold text-foreground">
                {initial.slug || "(set after first save)"}
              </span>
              . They can book a slot directly without calling. You stay
              in full control — toggle off any time.
            </p>
          </div>
          <label className="relative inline-flex shrink-0 cursor-pointer items-center">
            <input
              type="checkbox"
              name="public_listing"
              defaultChecked={initial.publicListing}
              className="peer sr-only"
            />
            <span className="block h-6 w-11 rounded-full bg-secondary transition-colors peer-checked:bg-primary" />
            <span className="absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow-md transition-transform peer-checked:translate-x-5" />
          </label>
        </div>
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
