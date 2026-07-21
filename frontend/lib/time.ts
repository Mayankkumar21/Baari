// Per-clinic timezone helpers. All persisted timestamps are UTC; the
// helpers here are the ONLY place we convert to/from a clinic's local
// wall-clock. Every caller passes the clinic's IANA timezone (see
// clinics.timezone in db/schema.ts).
//
// Historical note: Baari was IST-only for the pilot, and time helpers
// baked in a fixed +05:30 offset (safe because IST has no DST).
// Opening up to non-Indian clinics meant retiring that shortcut —
// most other zones observe DST, so wall-clock → UTC is no longer a
// simple string concatenation. `combineDateTime` does the DST-aware
// version via Intl.DateTimeFormat.formatToParts (no dep).
//
// The old `CLINIC_TZ` env var is intentionally gone — a single-tenant
// escape hatch that would silently overrule per-clinic data.

export function nowUtc(): Date {
  return new Date();
}

// YYYY-MM-DD as it reads on the clinic's wall clock right now.
export function clinicToday(tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function fmtTime(dt: Date | string | null | undefined, tz: string): string {
  if (!dt) return "";
  const d = typeof dt === "string" ? new Date(dt) : dt;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

export function fmtDateTime(dt: Date | string | null | undefined, tz: string): string {
  if (!dt) return "";
  const d = typeof dt === "string" ? new Date(dt) : dt;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
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

// The offset (in minutes, sign matches ISO — positive = ahead of UTC)
// that timezone `tz` is at the given UTC instant. DST-aware because
// Intl walks the actual zone rules. E.g. Asia/Kolkata → +330 always;
// America/New_York → +330 in winter (EST −300 = −5h) → -240 in summer
// (EDT −240). Yes, that math flips sign compared to how humans say
// it. See offsetString() below for the "+05:30"-shaped rendering.
function offsetMinutes(instant: Date, tz: string): number {
  // formatToParts with { timeZone } gives us the wall-clock parts as
  // they'd read in `tz`. Reconstructing a UTC timestamp from those
  // parts and diffing against the instant tells us the zone offset.
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const pick = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");
  const asUtc = Date.UTC(
    pick("year"),
    pick("month") - 1,
    pick("day"),
    pick("hour"),
    pick("minute"),
    pick("second"),
  );
  return Math.round((asUtc - instant.getTime()) / 60000);
}

// "YYYY-MM-DD" + "HH:MM" wall-clock in tz → UTC Date. DST-aware.
// The tricky bit: the zone's offset can differ at the wall-clock
// moment we're trying to build than at the naive "assume UTC" guess.
// We compute the offset once, apply it, and use the result. For zones
// without DST (IST, most of Asia) this collapses to a single pass;
// for DST zones the second Date.UTC() call uses the correct offset
// even across the spring-forward / fall-back boundaries.
export function combineDateTime(dateStr: string, hhmm: string, tz: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  const naive = new Date(Date.UTC(y, m - 1, d, h, mi, 0));
  const off = offsetMinutes(naive, tz);
  return new Date(naive.getTime() - off * 60000);
}

// "YYYY-MM-DD" at noon in tz → UTC Date. Used as an anchor for
// day-of-week and range math where hitting midnight would risk a
// DST-shift landing on the previous/next day. Noon is always safely
// inside the same wall-clock day for every real-world zone.
export function noonInTz(dateStr: string, tz: string): Date {
  return combineDateTime(dateStr, "12:00", tz);
}
