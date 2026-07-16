"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import {
  CountryCodePicker,
  defaultCountry,
  type Country,
} from "@/components/country-code-picker";
import { loginAction, type LoginState } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {});
  // Default from browser locale (India users see IN preselected, US
  // users see US, etc.) — nice touch for a global launch. The user
  // can always switch via the flag picker.
  const [country, setCountry] = useState<Country>(() => defaultCountry());
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
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
