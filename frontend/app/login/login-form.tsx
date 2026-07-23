"use client";

import { useActionState, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import {
  CountryCodePicker,
  useCountry,
} from "@/components/country-code-picker";
import { loginAction, type LoginState } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {});
  // SSR → India (deterministic, hydration-safe); client swaps to the
  // browser-detected country on mount. A US owner who signed up with
  // +1 sees +1 preselected without touching the flag picker.
  const [country, setCountry] = useCountry();
  const [national, setNational] = useState("");

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      {/* Hidden E.164 field — this is what the server action reads.
          The visible inputs are the country picker + the national
          number; we concatenate them here so backend code stays
          format-agnostic. */}
      <input
        type="hidden"
        name="mobile"
        value={national ? `+${country.dial}${national.replace(/\D/g, "")}` : ""}
      />
      <div className="space-y-1.5">
        <Label htmlFor="mobile-national">Mobile</Label>
        <div className="flex gap-2">
          <CountryCodePicker value={country} onChange={setCountry} />
          <Input
            id="mobile-national"
            inputMode="numeric"
            autoComplete="username"
            placeholder="Your mobile number"
            required
            autoFocus
            value={national}
            onChange={(e) =>
              setNational(e.target.value.replace(/[^\d\s\-().]/g, "").slice(0, 15))
            }
            className="flex-1"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <PasswordInput id="password" name="password" autoComplete="current-password" required />
      </div>
      {state.error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {state.error}
        </div>
      ) : null}
      <Button type="submit" variant="glow" size="lg" className="w-full" disabled={pending}>
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Signing in…
          </>
        ) : (
          "Sign in"
        )}
      </Button>
      {/* Progress hint that appears once submission is in flight.
          The action is expected to complete in &lt;2s on a warm Neon
          compute, but a cold pool can push it past 10s and the button
          text alone doesn't tell the user we're still working. */}
      {pending ? (
        <p className="text-center text-[11px] text-muted-foreground">
          One moment — waking the database…
        </p>
      ) : null}
    </form>
  );
}
