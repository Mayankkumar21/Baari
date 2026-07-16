"use client";

// Right-hand cell on each interest row: current status + quick actions.
// "Contact" opens a WhatsApp deep link with a prefilled message; "Mark
// contacted" / "Mark converted" flip the timestamps.

import { useTransition } from "react";
import {
  CheckCircle2,
  Mail,
  MessageCircle,
  MoreVertical,
} from "lucide-react";
import {
  markContactedAction,
  markConvertedAction,
} from "./actions";

export function InterestRowActions({
  interestId,
  contactedAt,
  convertedAt,
  mobile,
  email,
  desiredPlan,
  workspaceName,
}: {
  interestId: number;
  contactedAt: string | null;
  convertedAt: string | null;
  mobile: string | null;
  email: string | null;
  desiredPlan: string;
  workspaceName: string;
}) {
  const [pending, start] = useTransition();

  const waMessage = encodeURIComponent(
    `Hi! You asked about the Baari ${desiredPlan} plan for ${workspaceName}. Payments aren't fully wired yet but I'd love to close this off the phone — got 10 minutes?`,
  );
  // WhatsApp deep-link only works with digits + country code, no
  // '+' prefix.
  const waNumber = mobile ? mobile.replace(/\D/g, "") : "";
  const waHref = waNumber ? `https://wa.me/${waNumber}?text=${waMessage}` : "";
  const mailHref = email
    ? `mailto:${email}?subject=${encodeURIComponent(`Baari ${desiredPlan}`)}&body=${waMessage}`
    : "";

  if (convertedAt) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
        <CheckCircle2 className="size-3" /> Converted
      </span>
    );
  }

  return (
    <div className="flex items-center justify-end gap-1.5">
      {waHref ? (
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-md border border-emerald-400/40 bg-emerald-500/5 px-2 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-300"
          title="Open WhatsApp"
        >
          <MessageCircle className="size-3" /> WA
        </a>
      ) : null}
      {mailHref ? (
        <a
          href={mailHref}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-card/60 px-2 py-1 text-[11px] font-medium text-muted-foreground hover:border-primary/40 hover:text-foreground"
          title="Send email"
        >
          <Mail className="size-3" />
        </a>
      ) : null}
      {contactedAt ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => start(() => markConvertedAction(interestId).then(() => {}))}
          className="rounded-md border border-primary bg-primary px-2 py-1 text-[11px] font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          Mark converted
        </button>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => start(() => markContactedAction(interestId).then(() => {}))}
          className="rounded-md border border-border bg-card/60 px-2 py-1 text-[11px] font-medium text-muted-foreground hover:border-primary/40 hover:text-foreground disabled:opacity-50"
        >
          Mark contacted
        </button>
      )}
    </div>
  );
}
