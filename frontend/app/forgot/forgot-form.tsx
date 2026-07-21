"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import {
  CountryCodePicker,
  useCountry,
} from "@/components/country-code-picker";
import { capture } from "@/components/posthog-provider";

type Phase =
  | { kind: "mobile" }
  | { kind: "sending" }
  | { kind: "code"; mobile: string }
  | { kind: "resetting"; mobile: string };

// Single-page two-step forgot-password flow. Step one: enter mobile,
// backend emails a 6-digit code (silent if the account has no email on
// file — same non-oracle behaviour as the API). Step two: enter code +
// new password, backend verifies + rotates the hash.
export function ForgotForm() {
  const router = useRouter();
  const [country, setCountry] = useCountry();
  const [national, setNational] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "mobile" });
  const [error, setError] = useState<string | null>(null);

  const busy = phase.kind === "sending" || phase.kind === "resetting";

  // Build the E.164 form the API expects — same shape login uses.
  // normalizeMobile on the server handles both "+91…" and bare
  // national numbers, but sending E.164 keeps parity with signup so a
  // US owner who registered as +1415… can reset from that same number.
  const digits = national.replace(/\D/g, "");
  const e164 = digits ? `+${country.dial}${digits}` : "";

  const onSend = async () => {
    setError(null);
    if (digits.length < 6) {
      setError("Enter your mobile number.");
      return;
    }
    setPhase({ kind: "sending" });
    try {
      const r = await fetch("/api/v1/owner/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mobile: e164 }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(body?.error ?? `Couldn't send code (${r.status}).`);
        setPhase({ kind: "mobile" });
        return;
      }
      // Non-oracle: we advance to step 2 either way. If sent:false (no
      // email on file / no such user), the "Wrong code" error in step 2
      // will surface consistently.
      capture("password_reset_started", { surface: "web" });
      setPhase({ kind: "code", mobile: e164 });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error.");
      setPhase({ kind: "mobile" });
    }
  };

  const onReset = async () => {
    if (phase.kind !== "code") return;
    setError(null);
    const cleanedCode = code.replace(/[^0-9]/g, "");
    if (cleanedCode.length !== 6) {
      setError("Enter the 6-digit code from the email.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setPhase({ kind: "resetting", mobile: phase.mobile });
    try {
      const r = await fetch("/api/v1/owner/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mobile: phase.mobile, code: cleanedCode, password }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(body?.error ?? `Reset failed (${r.status}).`);
        setPhase({ kind: "code", mobile: phase.mobile });
        return;
      }
      capture("password_reset_completed", { surface: "web" });
      router.push("/login?reset=1");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error.");
      setPhase({ kind: "code", mobile: phase.mobile });
    }
  };

  if (phase.kind === "code" || phase.kind === "resetting") {
    return (
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground">
          If an account is registered on <span className="font-mono">{phase.mobile}</span> with
          an email on file, we sent a 6-digit code. Enter it below along with your new password.
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="code">Verification code</Label>
          <Input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
            autoFocus
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">New password</Label>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            placeholder="At least 8 characters, 1 letter + 1 number"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm">Confirm password</Label>
          <PasswordInput
            id="confirm"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        {error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        ) : null}
        <div className="flex items-center gap-2">
          <Button type="button" variant="glow" size="lg" className="flex-1" onClick={onReset} disabled={busy}>
            {phase.kind === "resetting" ? "Saving…" : "Set new password"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="text-muted-foreground"
            onClick={() => {
              setPhase({ kind: "mobile" });
              setCode("");
              setPassword("");
              setConfirm("");
              setError(null);
            }}
            disabled={busy}
          >
            Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="mobile-national">Registered mobile</Label>
        <div className="flex gap-2">
          <CountryCodePicker value={country} onChange={setCountry} />
          <Input
            id="mobile-national"
            inputMode="numeric"
            autoComplete="username"
            placeholder="Your mobile number"
            value={national}
            onChange={(e) =>
              setNational(e.target.value.replace(/[^\d\s\-().]/g, "").slice(0, 15))
            }
            autoFocus
            disabled={busy}
            className="flex-1"
          />
        </div>
      </div>
      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      ) : null}
      <Button type="button" variant="glow" size="lg" className="w-full" onClick={onSend} disabled={busy || digits.length < 6}>
        {phase.kind === "sending" ? "Sending…" : "Send verification code"}
      </Button>
    </div>
  );
}
