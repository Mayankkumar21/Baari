"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { cancelBookingAction, type CancelState } from "../actions";

const REASON_PRESETS_EN = ["Change of plan", "Running late", "Wrong booking", "Other"];
const REASON_PRESETS_HI = ["योजना बदल गई", "देर हो रही है", "गलत बुकिंग", "अन्य"];

export function CancelForm({
  token,
  lang,
  reasonLabel,
  keepLabel,
  cancelLabel,
}: {
  token: string;
  lang: "en" | "hi";
  reasonLabel: string;
  keepLabel: string;
  cancelLabel: string;
}) {
  const [state, action, pending] = useActionState<CancelState, FormData>(
    cancelBookingAction,
    {},
  );
  const presets = lang === "hi" ? REASON_PRESETS_HI : REASON_PRESETS_EN;
  const [selected, setSelected] = useState<string>("");

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="lang" value={lang} />
      <input type="hidden" name="reason" value={selected} />

      <div className="space-y-1.5">
        <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {reasonLabel}
        </label>
        <div className="flex flex-wrap gap-2">
          {presets.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setSelected(selected === r ? "" : r)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                selected === r
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border bg-card/60 text-muted-foreground"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {state.error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {state.error}
        </div>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 px-5 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center gap-2">
          <Link
            href={`/b/${token}/done${lang === "hi" ? "?lang=hi" : ""}`}
            className="flex-1 rounded-full border border-border bg-card/70 px-4 py-3 text-center text-sm font-semibold text-muted-foreground"
          >
            {keepLabel}
          </Link>
          <button
            type="submit"
            disabled={pending}
            className="flex-1 rounded-full bg-rose-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-rose-600/30 transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "…" : cancelLabel}
          </button>
        </div>
      </div>
    </form>
  );
}
