"use client";

import { useActionState, useState } from "react";
import { Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { bookAction, type BookState } from "./actions";
import { cn } from "@/lib/utils";
import { fmtTime } from "@/lib/time";

export function BookForm({
  slots,
  reasonLabel,
  entitySingular,
}: {
  slots: string[];
  reasonLabel: string;
  entitySingular: string;
}) {
  const [state, action, pending] = useActionState<BookState, FormData>(bookAction, {});
  const [slot, setSlot] = useState<string | null>(slots[0] ?? null);

  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="name">{entitySingular[0].toUpperCase() + entitySingular.slice(1)} name</Label>
          <Input id="name" name="name" required maxLength={80} autoFocus />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="mobile">Mobile</Label>
          <Input id="mobile" name="mobile" inputMode="numeric" required placeholder="10 digits" />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="reason">{reasonLabel}</Label>
          <Input id="reason" name="reason" maxLength={200} />
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
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" name="whatsapp_opt_out" className="accent-primary" /> Don't send WhatsApp
        </label>
      </div>

      <div>
        <Label className="mb-2 block">Slot today</Label>
        {slots.length === 0 ? (
          <div className="rounded-md border border-dashed border-border bg-card/40 p-6 text-center text-sm text-muted-foreground">
            No slots available today. Check opening hours in Settings.
          </div>
        ) : (
          <div className="grid max-h-60 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-5 md:grid-cols-6">
            {slots.map((iso) => (
              <button
                key={iso}
                type="button"
                onClick={() => setSlot(iso)}
                className={cn(
                  "rounded-md border px-2 py-2 text-sm font-medium transition-all backdrop-blur",
                  slot === iso
                    ? "border-primary bg-primary/15 text-foreground shadow-[0_0_0_1px_hsl(var(--primary)/0.5)]"
                    : "border-border bg-card/60 text-muted-foreground hover:border-primary/40",
                )}
              >
                {fmtTime(iso)}
              </button>
            ))}
          </div>
        )}
        <input type="hidden" name="slot_time" value={slot ?? ""} />
      </div>

      {state.error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {state.error}
        </div>
      ) : null}

      <Button type="submit" variant="glow" size="lg" disabled={pending || !slot}>
        <Calendar className="size-4" /> {pending ? "Booking…" : "Create booking"}
      </Button>
    </form>
  );
}
