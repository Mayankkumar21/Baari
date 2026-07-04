"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { forgotAction, type ForgotState } from "./actions";

export function ForgotForm() {
  const [state, action, pending] = useActionState<ForgotState, FormData>(forgotAction, {});
  if (state.sent) {
    return (
      <div className="rounded-md border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
        <p className="font-medium">Check your email.</p>
        <p className="text-muted-foreground text-xs mt-1">
          If an account is registered on that mobile with an email, we've sent a reset link. It expires in 30 minutes.
        </p>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="mobile">Registered mobile</Label>
        <Input
          id="mobile"
          name="mobile"
          inputMode="numeric"
          autoComplete="username"
          placeholder="10-digit number"
          required
          autoFocus
        />
      </div>
      {state.error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {state.error}
        </div>
      ) : null}
      <Button type="submit" variant="glow" size="lg" className="w-full" disabled={pending}>
        {pending ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}
