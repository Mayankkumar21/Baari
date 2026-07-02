"use client";

import { useActionState, useState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { saveBookingsSettings, type BookingsState } from "../actions";

export function BookingsForm({
  initial,
}: {
  initial: {
    acceptAppBookings: boolean;
    catalogue: string[];
    allowed: string[];
  };
}) {
  const [state, action, pending] = useActionState<BookingsState, FormData>(
    saveBookingsSettings,
    {},
  );
  const [accepting, setAccepting] = useState(initial.acceptAppBookings);

  return (
    <form action={action} className="space-y-6">
      <div className="flex items-start justify-between gap-4 rounded-md border border-border bg-card/40 p-4">
        <div className="min-w-0">
          <Label htmlFor="accept_app_bookings" className="text-sm font-semibold">
            Accept bookings from the Baari app
          </Label>
          <p className="mt-1 text-xs text-muted-foreground">
            When off, your workspace is hidden from the customer app and
            the app can&apos;t create bookings here. Your front-desk queue
            is unaffected.
          </p>
        </div>
        <label className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center">
          <input
            id="accept_app_bookings"
            name="accept_app_bookings"
            type="checkbox"
            checked={accepting}
            onChange={(e) => setAccepting(e.target.checked)}
            className="peer sr-only"
          />
          <span className="absolute inset-0 rounded-full bg-muted transition-colors peer-checked:bg-primary" />
          <span className="absolute left-0.5 top-0.5 size-5 rounded-full bg-background shadow transition-transform peer-checked:translate-x-5" />
        </label>
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <Label className="text-sm font-semibold">Bookable services</Label>
          <span className="text-[11px] text-muted-foreground">
            {initial.catalogue.length} available
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Only ticked services appear on the confirm sheet. Untick a
          service to keep it off the app (e.g. vaccination, which usually
          needs a phone call first). Ticking every service is the same as
          &quot;all bookable.&quot;
        </p>
        <div
          className={cn(
            "grid gap-2 pt-1 sm:grid-cols-2",
            !accepting && "pointer-events-none opacity-50",
          )}
          aria-disabled={!accepting}
        >
          {initial.catalogue.map((s) => {
            const on = initial.allowed.includes(s);
            return (
              <label
                key={s}
                className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-card/40 px-3 py-2 text-sm transition-colors hover:border-primary/40 has-[input:checked]:border-primary has-[input:checked]:bg-primary/5"
              >
                <input
                  type="checkbox"
                  name={`service:${s}`}
                  defaultChecked={on}
                  className="size-4 rounded border-border accent-primary"
                />
                <span>{s}</span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground">
          {state.ok ? "Saved." : state.error ? (
            <span className="text-destructive">{state.error}</span>
          ) : null}
        </div>
        <Button type="submit" disabled={pending}>
          <Save className="size-4" /> {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
