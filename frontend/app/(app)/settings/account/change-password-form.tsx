"use client";

import { useActionState, useState } from "react";
import { Check, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { changePassword, type ChangePasswordState } from "../actions";
import { cn } from "@/lib/utils";

function checks(p: string) {
  return [
    { key: "len", label: "8+ characters", ok: p.length >= 8 },
    { key: "letter", label: "Has a letter", ok: /[A-Za-z]/.test(p) },
    { key: "digit", label: "Has a number", ok: /\d/.test(p) },
  ];
}

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState<ChangePasswordState, FormData>(
    changePassword,
    {},
  );
  const [next, setNext] = useState("");
  const c = checks(next);
  const allOk = c.every((x) => x.ok);

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="current">Current password</Label>
        <PasswordInput id="current" name="current" required autoComplete="current-password" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="next">New password</Label>
          <PasswordInput
            id="next"
            name="next"
            required
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm">Confirm new password</Label>
          <PasswordInput id="confirm" name="confirm" required autoComplete="new-password" />
        </div>
      </div>
      <div className="flex flex-wrap gap-3 text-[11px]">
        {c.map((x) => (
          <span
            key={x.key}
            className={cn(
              "inline-flex items-center gap-1 transition-colors",
              x.ok ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
            )}
          >
            <Check className={cn("size-3", x.ok ? "opacity-100" : "opacity-30")} />
            {x.label}
          </span>
        ))}
      </div>

      {state.error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {state.error}
        </div>
      ) : null}
      {state.ok ? (
        <div className="rounded-md border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-600 dark:text-emerald-300">
          Password updated.
        </div>
      ) : null}

      <Button type="submit" variant="glow" disabled={pending || !allOk}>
        <Save className="size-4" /> {pending ? "Saving…" : "Update password"}
      </Button>
    </form>
  );
}
