"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
  const [mobile, setMobile] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "mobile" });
  const [error, setError] = useState<string | null>(null);

  const busy = phase.kind === "sending" || phase.kind === "resetting";

  const onSend = async () => {
    setError(null);
    const m = mobile.trim();
    if (!/^[6-9]\d{9}$/.test(m)) {
      setError("Enter a valid 10-digit mobile.");
      return;
    }
    setPhase({ kind: "sending" });
    try {
      const r = await fetch("/api/v1/owner/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mobile: m }),
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
      setPhase({ kind: "code", mobile: m });
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
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            placeholder="At least 8 characters, 1 letter + 1 number"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm">Confirm password</Label>
          <Input
            id="confirm"
            type="password"
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
        <Label htmlFor="mobile">Registered mobile</Label>
        <Input
          id="mobile"
          inputMode="numeric"
          autoComplete="username"
          placeholder="10-digit number"
          value={mobile}
          onChange={(e) => {
            let d = e.target.value.replace(/[^0-9]/g, "");
            if (d.length > 10 && d.startsWith("91")) d = d.slice(2);
            setMobile(d.slice(0, 10));
          }}
          autoFocus
          disabled={busy}
        />
      </div>
      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      ) : null}
      <Button type="button" variant="glow" size="lg" className="w-full" onClick={onSend} disabled={busy || mobile.length !== 10}>
        {phase.kind === "sending" ? "Sending…" : "Send verification code"}
      </Button>
    </div>
  );
}
