// Range helpers for the Reports page. All YYYY-MM-DD strings in IST.
const TZ = process.env.CLINIC_TZ ?? "Asia/Kolkata";

function fmtYmd(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function addDays(ymd: string, days: number): string {
  // Anchor at noon-IST to dodge DST edge cases (IST has none, but the
  // pattern is portable). Then setDate() handles month/year rollover.
  const d = new Date(`${ymd}T12:00:00+05:30`);
  d.setDate(d.getDate() + days);
  return fmtYmd(d);
}

export function fmtRangeLabel(fromInclusive: string, toExclusive: string): string {
  const fromD = new Date(`${fromInclusive}T12:00:00+05:30`);
  const lastD = new Date(`${addDays(toExclusive, -1)}T12:00:00+05:30`);
  const opts: Intl.DateTimeFormatOptions = { timeZone: TZ, day: "numeric", month: "short" };
  if (fromInclusive === addDays(toExclusive, -1)) {
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
): ComputedRange {
  const today = fmtYmd(new Date());
  const tomorrow = addDays(today, 1);

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
    from = addDays(to, -7);
    label = "Last 7 days";
  } else if (rangeRaw === "custom" && fromRaw && toRaw && /^\d{4}-\d{2}-\d{2}$/.test(fromRaw) && /^\d{4}-\d{2}-\d{2}$/.test(toRaw)) {
    range = "custom";
    from = fromRaw;
    to = addDays(toRaw, 1);
    label = "Custom range";
  } else {
    // Default — 30d
    range = "30d";
    to = tomorrow;
    from = addDays(to, -30);
    label = "Last 30 days";
  }

  const lengthDays = Math.round(
    (new Date(`${to}T12:00:00+05:30`).getTime() -
      new Date(`${from}T12:00:00+05:30`).getTime()) /
      86_400_000,
  );
  const prevTo = from;
  const prevFrom = addDays(prevTo, -lengthDays);

  return {
    range,
    from,
    to,
    prevFrom,
    prevTo,
    label,
    dateLabel: fmtRangeLabel(from, to),
    prevDateLabel: fmtRangeLabel(prevFrom, prevTo),
  };
}
