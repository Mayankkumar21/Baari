"use client";

// "I want this plan" capture flow. Payments aren't wired yet — this
// modal collects contact + intent instead so the founder can reach
// out manually. Owners already signed in see their email/mobile
// prefilled; they can add a note ("we want 5 seats", "we're a chain",
// etc.) and hit send.

import { useActionState, useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  recordPlanInterestAction,
  type InterestState,
} from "./interest-actions";

export function InterestButton({
  desiredPlan,
  planLabel,
  buttonLabel,
  region,
  defaultEmail,
  defaultMobile,
  variant = "outline",
}: {
  desiredPlan: "growth" | "pro";
  planLabel: string;
  buttonLabel: string;
  region: "IN" | "GLOBAL";
  defaultEmail: string;
  defaultMobile: string;
  variant?: "glow" | "outline";
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        size="lg"
        variant={variant}
        className="w-full"
      >
        {buttonLabel}
      </Button>
      {open ? (
        <InterestModal
          desiredPlan={desiredPlan}
          planLabel={planLabel}
          region={region}
          defaultEmail={defaultEmail}
          defaultMobile={defaultMobile}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function InterestModal({
  desiredPlan,
  planLabel,
  region,
  defaultEmail,
  defaultMobile,
  onClose,
}: {
  desiredPlan: "growth" | "pro";
  planLabel: string;
  region: "IN" | "GLOBAL";
  defaultEmail: string;
  defaultMobile: string;
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState<InterestState, FormData>(
    recordPlanInterestAction,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>

        {state.ok ? (
          <SuccessState onClose={onClose} planLabel={planLabel} />
        ) : (
          <>
            <div className="mb-4">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-primary">
                <Sparkles className="size-3" /> {planLabel}
              </div>
              <h3 className="mt-3 text-lg font-bold">
                Payments aren&apos;t wired yet — but leave your details.
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                We&apos;ll email or WhatsApp you the moment {planLabel.toLowerCase()} is
                available for your region. Your trial keeps running meanwhile — nothing
                changes on your workspace.
              </p>
            </div>

            <form ref={formRef} action={action} className="space-y-3">
              <input type="hidden" name="desired_plan" value={desiredPlan} />
              <input type="hidden" name="region" value={region} />

              <div>
                <Label htmlFor="email" className="mb-1 block text-xs">
                  Email
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  defaultValue={defaultEmail}
                  placeholder="you@example.com"
                  required
                />
              </div>

              <div>
                <Label htmlFor="mobile" className="mb-1 block text-xs">
                  Mobile <span className="text-muted-foreground">(with country code)</span>
                </Label>
                <Input
                  id="mobile"
                  name="mobile"
                  type="tel"
                  defaultValue={defaultMobile}
                  placeholder="+91 98765 43210"
                />
              </div>

              <div>
                <Label htmlFor="note" className="mb-1 block text-xs">
                  Anything specific? <span className="text-muted-foreground">(optional)</span>
                </Label>
                <textarea
                  id="note"
                  name="note"
                  maxLength={500}
                  rows={3}
                  placeholder="e.g. 5 staff, single location, chain of 3, need INR billing…"
                  className="w-full rounded-md border border-border bg-secondary/40 px-3 py-2 text-sm outline-none focus:border-primary/60"
                />
              </div>

              {state.error ? (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1.5 text-[11px] text-destructive">
                  {state.error}
                </div>
              ) : null}

              <Button
                type="submit"
                variant="glow"
                className="w-full"
                disabled={pending}
              >
                {pending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Sending…
                  </>
                ) : (
                  "Notify me when it&apos;s live"
                )}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

function SuccessState({
  planLabel,
  onClose,
}: {
  planLabel: string;
  onClose: () => void;
}) {
  return (
    <div className="text-center">
      <div className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">
        <CheckCircle2 className="size-6" />
      </div>
      <h3 className="text-lg font-bold">You&apos;re on the list.</h3>
      <p className="mt-1.5 text-sm text-muted-foreground">
        We&apos;ll reach out about {planLabel} as soon as we&apos;re accepting
        payments in your region. Your Pro trial keeps running in the meantime.
      </p>
      <Button onClick={onClose} variant="outline" className="mt-4 w-full">
        Back to the dashboard
      </Button>
    </div>
  );
}
