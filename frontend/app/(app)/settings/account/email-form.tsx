"use client";

import { useActionState, useState } from "react";
import { Mail, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveEmail, type SaveEmailState } from "../actions";

export function EmailForm({ currentEmail }: { currentEmail: string | null }) {
  const initial: SaveEmailState = { email: currentEmail };
  const [state, action, pending] = useActionState<SaveEmailState, FormData>(saveEmail, initial);
  // Track the "current" value between renders — server-action result wins,
  // otherwise fall back to the prop from the parent RSC.
  const savedEmail = state.email !== undefined ? state.email : currentEmail;
  const [value, setValue] = useState<string>(savedEmail ?? "");

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email">Email address</Label>
        <div className="flex items-center gap-2">
          <Mail className="size-4 text-muted-foreground shrink-0" />
          <Input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        <p className="text-[11px] text-muted-foreground pt-1">
          Used only for password reset. Not shown to your customers.
        </p>
      </div>

      {state.error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {state.error}
        </div>
      ) : null}
      {state.ok ? (
        <div className="rounded-md border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-600 dark:text-emerald-300">
          {savedEmail ? "Email saved." : "Email removed."}
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <Button type="submit" variant="glow" disabled={pending || !value.trim()}>
          <Save className="size-4" /> {pending ? "Saving…" : savedEmail ? "Update email" : "Save email"}
        </Button>
        {savedEmail ? (
          <Button
            type="submit"
            name="remove"
            value="1"
            variant="ghost"
            className="text-muted-foreground"
            disabled={pending}
            formNoValidate
          >
            <X className="size-4" /> Remove
          </Button>
        ) : null}
      </div>
    </form>
  );
}
