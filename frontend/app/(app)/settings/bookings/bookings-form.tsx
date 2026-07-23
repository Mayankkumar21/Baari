"use client";

import Link from "next/link";
import { useActionState } from "react";
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
  // "Accept bookings" was duplicated here and in Settings > Workspace
  // as "Show on Baari app" — same knob, two labels. Merged into the
  // workspace toggle; this page now only picks which SERVICES are
  // bookable when the app is on. When the workspace toggle is off,
  // the service allowlist grays out but is still editable so an owner
  // can prep before flipping the workspace switch back on.
  const accepting = initial.acceptAppBookings;

  return (
    <form action={action} className="space-y-6">
      {!accepting ? (
        <div className="rounded-md border border-primary/30 bg-primary/8 p-4 text-xs text-foreground">
          <div className="font-semibold">Baari app is off for this workspace.</div>
          <p className="mt-1 text-muted-foreground">
            Turn on <strong className="text-foreground">Show on Baari app</strong>{" "}
            in{" "}
            <Link href="/settings/workspace" className="text-primary hover:underline">
              Settings → Workspace
            </Link>{" "}
            to accept bookings from the customer app. The service list below
            takes effect once it&apos;s on.
          </p>
        </div>
      ) : null}

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
            !accepting && "opacity-60",
          )}
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
