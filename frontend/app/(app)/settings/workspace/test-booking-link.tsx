"use client";

import { useActionState } from "react";
import { Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { makeTestBookingLink, type TestLinkState } from "../actions";

export function TestBookingLinkButton() {
  const [state, action, pending] = useActionState<TestLinkState, FormData>(
    makeTestBookingLink,
    {},
  );

  return (
    <form action={action} className="space-y-2">
      <Button type="submit" variant="outline" disabled={pending}>
        <Link2 className="size-4" /> {pending ? "Opening…" : "Preview customer booking flow"}
      </Button>
      {state.error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {state.error}
        </div>
      ) : null}
      <p className="text-[11px] text-muted-foreground">
        Generates a booking link for your own mobile and opens it — so you
        can walk through the screens a customer would see after a
        missed call.
      </p>
    </form>
  );
}
