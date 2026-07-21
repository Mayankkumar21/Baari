// Range helpers for the Reports page. All YYYY-MM-DD strings resolve
// in the clinic's timezone. `computeRange` / `fmtRangeLabel` each
// accept `tz` explicitly — callers read it from `sess.clinic.timezone`.
import { noonInTz } from "@/lib/time";

function fmtYmd(d: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function addDays(ymd: string, days: number, tz: string): string {
  // Anchor at noon in the clinic's tz so a DST spring-forward can't
  // land us on the previous/next day. setDate() then handles
  // month/year rollover cleanly.
  const d = noonInTz(ymd, tz);
  d.setDate(d.getDate() + days);
  return fmtYmd(d, tz);
}

export function fmtRangeLabel(fromInclusive: string, toExclusive: string, tz: string): string {
  const fromD = noonInTz(fromInclusive, tz);
  const lastD = noonInTz(addDays(toExclusive, -1, tz), tz);
  const opts: Intl.DateTimeFormatOptions = { timeZone: tz, day: "numeric", month: "short" };
  if (fromInclusive === addDays(toExclusive, -1, tz)) {
    return new Intl.DateTimeFormat("en-GB", { ...opts, year: "numeric" }).format(fromD);
  }
  return `${new Intl.DateTimeFormat("en-GB", opts).format(fromD)} – ${new Intl.DateTimeFormat(
    "en-GB",
    opts,
  ).format(lastD)}`;
}

export type Range = "today" | "7d" | "30d" | "custom";

export type ComputedRange = {
  range: Range;
  from: string; // YYYY-MM-DD inclusive
  to: string; // YYYY-MM-DD exclusive
  prevFrom: string;
  prevTo: string;
  label: string;
  dateLabel: string;
  prevDateLabel: string;
};

export function computeRange(
  rangeRaw: string | undefined,
  fromRaw: string | undefined,
  toRaw: string | undefined,
  tz: string,
): ComputedRange {
  const today = fmtYmd(new Date(), tz);
  const tomorrow = addDays(today, 1, tz);

  let from: string;
  let to: string;
  let label: string;
  let range: Range;

  if (rangeRaw === "today") {
    range = "today";
    from = today;
    to = tomorrow;
    label = "Today";
  } else if (rangeRaw === "7d") {
    range = "7d";
    to = tomorrow;
    from = addDays(to, -7, tz);
    label = "Last 7 days";
  } else if (rangeRaw === "custom" && fromRaw && toRaw && /^\d{4}-\d{2}-\d{2}$/.test(fromRaw) && /^\d{4}-\d{2}-\d{2}$/.test(toRaw)) {
    range = "custom";
    from = fromRaw;
    to = addDays(toRaw, 1, tz);
    label = "Custom range";
  } else {
    // Default — 30d
    range = "30d";
    to = tomorrow;
    from = addDays(to, -30, tz);
    label = "Last 30 days";
  }

  const lengthDays = Math.round(
    (noonInTz(to, tz).getTime() - noonInTz(from, tz).getTime()) / 86_400_000,
  );
  const prevTo = from;
  const prevFrom = addDays(prevTo, -lengthDays, tz);

  return {
    range,
    from,
    to,
    prevFrom,
    prevTo,
    label,
    dateLabel: fmtRangeLabel(from, to, tz),
    prevDateLabel: fmtRangeLabel(prevFrom, prevTo, tz),
  };
}
