"use client";

import { useState } from "react";
import { Mail, Save, X, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { removeEmail } from "../actions";

type Phase =
  | { kind: "idle" }                             // showing input, no code sent yet
  | { kind: "sending" }                          // requesting code
  | { kind: "code"; email: string }              // code sent, awaiting entry
  | { kind: "verifying"; email: string }         // verifying entered code
  | { kind: "removing" };                        // deleting the stored email

// Two-step add/change email flow. First step sends a 6-digit code to the
// candidate email; second step verifies the code and writes the email.
// Removal uses the plain server action (no OTP needed — controlling the
// session is proof enough to unset an address).
export function EmailForm({ currentEmail }: { currentEmail: string | null }) {
  const [savedEmail, setSavedEmail] = useState<string | null>(currentEmail);
  const [pendingEmail, setPendingEmail] = useState("");
  const [code, setCode] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const busy =
    phase.kind === "sending" ||
    phase.kind === "verifying" ||
    phase.kind === "removing";

  const onSendCode = async () => {
    setError(null);
    setSuccessMsg(null);
    const email = pendingEmail.trim().toLowerCase();
    if (!email) {
      setError("Enter an email first.");
      return;
    }
    setPhase({ kind: "sending" });
    try {
      const r = await fetch("/api/v1/owner/email/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(body?.error ?? `Couldn't send code (${r.status}).`);
        setPhase({ kind: "idle" });
        return;
      }
      setPhase({ kind: "code", email });
      setCode("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error.");
      setPhase({ kind: "idle" });
    }
  };

  const onVerify = async () => {
    if (phase.kind !== "code") return;
    setError(null);
    const cleaned = code.replace(/[^0-9]/g, "");
    if (cleaned.length !== 6) {
      setError("Enter the 6-digit code from the email.");
      return;
    }
    setPhase({ kind: "verifying", email: phase.email });
    try {
      const r = await fetch("/api/v1/owner/email/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: phase.email, code: cleaned }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(body?.error ?? `Verify failed (${r.status}).`);
        setPhase({ kind: "code", email: phase.email });
        return;
      }
      setSavedEmail(phase.email);
      setPendingEmail("");
      setCode("");
      setPhase({ kind: "idle" });
      setSuccessMsg("Email saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error.");
      setPhase({ kind: "code", email: phase.email });
    }
  };

  const onRemove = async () => {
    setError(null);
    setSuccessMsg(null);
    setPhase({ kind: "removing" });
    try {
      await removeEmail();
      setSavedEmail(null);
      setPhase({ kind: "idle" });
      setSuccessMsg("Email removed.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't remove — try again.");
      setPhase({ kind: "idle" });
    }
  };

  return (
    <div className="space-y-4">
      {savedEmail ? (
        <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
          <div className="flex items-center gap-2 min-w-0">
            <ShieldCheck className="size-4 text-emerald-600 shrink-0" />
            <span className="text-sm truncate">{savedEmail}</span>
            <span className="text-[11px] text-muted-foreground shrink-0">verified</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            disabled={busy}
            onClick={onRemove}
          >
            <X className="size-4" /> Remove
          </Button>
        </div>
      ) : null}

      {phase.kind === "code" || phase.kind === "verifying" ? (
        <div className="space-y-3 rounded-md border border-primary/30 bg-primary/5 p-4">
          <div className="text-sm">
            <div className="font-medium">Enter the 6-digit code we sent to</div>
            <div className="text-primary font-mono text-xs pt-0.5">{phase.email}</div>
          </div>
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
          {error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          ) : null}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="glow"
              onClick={onVerify}
              disabled={busy || code.length !== 6}
            >
              <ShieldCheck className="size-4" />
              {phase.kind === "verifying" ? "Verifying…" : "Verify + save"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="text-muted-foreground"
              onClick={onSendCode}
              disabled={busy}
            >
              Resend code
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="text-muted-foreground"
              onClick={() => {
                setPhase({ kind: "idle" });
                setCode("");
                setError(null);
              }}
              disabled={busy}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="email">
              {savedEmail ? "Change email" : "Add email"}
            </Label>
            <div className="flex items-center gap-2">
              <Mail className="size-4 text-muted-foreground shrink-0" />
              <Input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={pendingEmail}
                onChange={(e) => setPendingEmail(e.target.value)}
                disabled={busy}
              />
            </div>
            <p className="text-[11px] text-muted-foreground pt-1">
              We'll email a 6-digit code to confirm you own this address.
            </p>
          </div>
          {error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          ) : null}
          {successMsg ? (
            <div className="rounded-md border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-600 dark:text-emerald-300">
              {successMsg}
            </div>
          ) : null}
          <Button
            type="button"
            variant="glow"
            onClick={onSendCode}
            disabled={busy || !pendingEmail.trim()}
          >
            <Save className="size-4" />
            {phase.kind === "sending" ? "Sending…" : "Send code"}
          </Button>
        </div>
      )}
    </div>
  );
}
