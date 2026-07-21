"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MapPin, Phone } from "lucide-react";
import { t } from "@/lib/i18n-mini";
import { fmtTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { StatusFeed } from "@/lib/services/status-feed";

const POLL_MS = 15_000;

type Pill =
  | { tone: "primary"; text: string }
  | { tone: "amber"; text: string }
  | { tone: "emerald-pulse"; text: string }
  | { tone: "emerald"; text: string }
  | { tone: "grey"; text: string }
  | { tone: "rose"; text: string };

function statusPill(feed: StatusFeed, lang: "en" | "hi"): Pill {
  if (feed.status === "cancelled") {
    return { tone: "rose", text: t("cancelled_state", lang) };
  }
  if (feed.status === "done") {
    return { tone: "grey", text: t("all_done", lang) };
  }
  if (feed.status === "in_consult") {
    return { tone: "emerald-pulse", text: t("your_turn", lang) };
  }
  // booked + checked_in
  if (feed.position === 0) {
    return { tone: "amber", text: t("youre_next", lang) };
  }
  return {
    tone: "primary",
    text: `${t("youre_position", lang)}${feed.position + 1} ${t("in_queue", lang)}`.trim(),
  };
}

function pillClasses(tone: Pill["tone"]) {
  switch (tone) {
    case "primary":
      return "border-primary/40 bg-primary/15 text-primary";
    case "amber":
      return "border-amber-400/40 bg-amber-500/15 text-amber-700 dark:text-amber-300";
    case "emerald-pulse":
      return "border-emerald-400/50 bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 animate-pulse";
    case "emerald":
      return "border-emerald-400/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
    case "grey":
      return "border-border bg-secondary/60 text-muted-foreground";
    case "rose":
      return "border-rose-400/40 bg-rose-500/15 text-rose-700 dark:text-rose-300";
  }
}

export function LiveStatus({
  token,
  lang,
  initial,
  tz,
}: {
  token: string;
  lang: "en" | "hi";
  initial: StatusFeed;
  tz: string;
}) {
  const [feed, setFeed] = useState<StatusFeed>(initial);
  const [tick, setTick] = useState(0);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const id = setInterval(() => setTick((n) => n + 1), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setUpdating(true);
    fetch(`/b/${token}/status/feed`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (cancelled || !j?.ok) return;
        setFeed(j.feed as StatusFeed);
      })
      .catch(() => {})
      .finally(() => !cancelled && setUpdating(false));
    return () => {
      cancelled = true;
    };
  }, [tick, token]);

  const pill = statusPill(feed, lang);
  const helper = helperText(feed, lang);
  const mapsUrl = feed.clinicAddress
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${feed.clinicName} ${feed.clinicAddress}`)}`
    : null;
  const canCancel = (feed.status === "booked" || feed.status === "checked_in") &&
    minutesUntil(feed.slotIso) > 30;

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          {lang === "hi" ? "टोकन" : "Token"}
        </div>
        <div className="text-6xl font-extrabold leading-none tracking-tight text-foreground">
          T-{feed.token}
        </div>
        <div className="mt-2 text-xs text-muted-foreground tabular-nums">
          {lang === "hi" ? "स्लॉट" : "Slot"}: {fmtTime(feed.slotIso, tz)}
        </div>
      </div>

      <div
        className={cn(
          "rounded-2xl border px-4 py-5 text-center text-sm font-semibold",
          pillClasses(pill.tone),
        )}
      >
        {pill.text}
      </div>

      {feed.estWaitMinutes != null ? (
        <div className="text-center text-xs text-muted-foreground tabular-nums">
          {t("estimated_wait", lang, { n: feed.estWaitMinutes })}
        </div>
      ) : null}

      <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
        <span
          className={cn(
            "size-1.5 rounded-full",
            updating ? "bg-emerald-500 animate-pulse" : "bg-emerald-500/70",
          )}
        />
        {t("updating", lang)}
      </div>

      {helper ? <p className="text-center text-sm text-muted-foreground">{helper}</p> : null}

      <div className="border-t border-border pt-4 text-center">
        <div className="text-sm font-semibold">{feed.clinicName}</div>
        {feed.clinicAddress ? (
          <div className="text-xs text-muted-foreground">{feed.clinicAddress}</div>
        ) : null}
        <div className="mt-3 flex items-center justify-center gap-2">
          {mapsUrl ? (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-full border border-border bg-card/60 px-3 py-1.5 text-xs font-medium"
            >
              <MapPin className="size-3.5" /> {t("get_directions", lang)}
            </a>
          ) : null}
          <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-border bg-card/40 px-3 py-1.5 text-xs font-medium text-muted-foreground/60">
            <Phone className="size-3.5" /> {t("call_business", lang)}
          </span>
        </div>
      </div>

      {canCancel ? (
        <div className="text-center">
          <Link
            href={`/b/${token}/cancel${lang === "hi" ? "?lang=hi" : ""}`}
            className="text-xs font-semibold text-rose-500 hover:underline"
          >
            {t("cancel_booking", lang)}
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function helperText(feed: StatusFeed, lang: "en" | "hi"): string | null {
  if (feed.status === "in_consult") return null;
  if (feed.status === "done") return null;
  if (feed.status === "cancelled") return null;
  if (feed.position === 0) return t("next_help", lang);
  return t("waiting_help", lang);
}

function minutesUntil(iso: string): number {
  return Math.round((new Date(iso).getTime() - Date.now()) / 60000);
}
