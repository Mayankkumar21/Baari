"use client";

import { useActionState, useState } from "react";
import { confirmBookingAction, type ConfirmState } from "../actions";

export function DetailsForm({
  token,
  lang,
  slotIso,
  services,
  reasonLabel,
  nameLabel,
  firstVisitLabel,
  confirmLabel,
  otherLabel,
  smsNote,
  entitySingular,
}: {
  token: string;
  lang: "en" | "hi";
  slotIso: string;
  services: string[];
  reasonLabel: string;
  nameLabel: string;
  firstVisitLabel: string;
  confirmLabel: string;
  otherLabel: string;
  smsNote: string;
  entitySingular: string;
}) {
  const [state, action, pending] = useActionState<ConfirmState, FormData>(
    confirmBookingAction,
    {},
  );
  const [reasonMode, setReasonMode] = useState<"preset" | "custom">("preset");
  const [reason, setReason] = useState<string>(services[0] ?? "");
  const [customReason, setCustomReason] = useState("");

  const effectiveReason = reasonMode === "custom" ? customReason : reason;

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="slot_time" value={slotIso} />
      <input type="hidden" name="lang" value={lang} />
      <input type="hidden" name="reason" value={effectiveReason} />

      <div className="space-y-1.5">
        <label htmlFor="name" className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {nameLabel}
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          minLength={2}
          maxLength={80}
          autoFocus
          autoComplete="name"
          placeholder={
            lang === "hi" ? `${entitySingular} का नाम` : `${entitySingular[0].toUpperCase()}${entitySingular.slice(1)} name`
          }
          className="h-12 w-full rounded-xl border border-input bg-card/60 px-4 text-base backdrop-blur focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="service" className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {reasonLabel}
        </label>
        {reasonMode === "preset" ? (
          <select
            id="service"
            value={reason}
            onChange={(e) => {
              if (e.target.value === "__custom__") {
                setReasonMode("custom");
              } else {
                setReason(e.target.value);
              }
            }}
            className="flex h-12 w-full rounded-xl border border-input bg-card/60 px-3 text-base backdrop-blur focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {services.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
            <option value="__custom__">+ {otherLabel}</option>
          </select>
        ) : (
          <div className="flex gap-2">
            <input
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              maxLength={200}
              placeholder={otherLabel}
              className="h-12 flex-1 rounded-xl border border-input bg-card/60 px-4 text-base backdrop-blur focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            />
            <button
              type="button"
              onClick={() => {
                setReasonMode("preset");
                setCustomReason("");
              }}
              className="rounded-xl border border-border px-3 text-xs font-semibold text-muted-foreground"
            >
              ←
            </button>
          </div>
        )}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="is_new"
          defaultChecked
          className="size-4 accent-primary"
        />
        <span>{firstVisitLabel}</span>
      </label>

      {state.error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {state.error}
        </div>
      ) : null}

      {/* Sticky bottom CTA */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 px-5 py-3 backdrop-blur">
        <div className="mx-auto max-w-md space-y-1.5">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/30 transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-secondary disabled:text-muted-foreground disabled:shadow-none"
          >
            {pending ? "…" : confirmLabel}
          </button>
          <p className="text-center text-[10px] text-muted-foreground">{smsNote}</p>
        </div>
      </div>
    </form>
  );
}
