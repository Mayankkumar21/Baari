// IST (Asia/Kolkata) time helpers — port of app/time_utils.py.
// All persisted timestamps are UTC; UI formatting always converts to IST.
const CLINIC_TZ = process.env.CLINIC_TZ ?? "Asia/Kolkata";

export function nowUtc(): Date {
  return new Date();
}

export function clinicToday(): string {
  // Returns YYYY-MM-DD in clinic tz.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CLINIC_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function fmtTime(dt: Date | string | null | undefined): string {
  if (!dt) return "";
  const d = typeof dt === "string" ? new Date(dt) : dt;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: CLINIC_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

export function fmtDateTime(dt: Date | string | null | undefined): string {
  if (!dt) return "";
  const d = typeof dt === "string" ? new Date(dt) : dt;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: CLINIC_TZ,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(d)
    .replace(",", " ·");
}

export function combineDateTime(dateStr: string, hhmm: string): Date {
  // Combine YYYY-MM-DD + HH:MM in clinic tz, return UTC Date.
  // Indian timezone has no DST so a fixed +05:30 offset is exact.
  return new Date(`${dateStr}T${hhmm}:00+05:30`);
}
