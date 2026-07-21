// Shared timezone helpers. Used by:
//   - signup (autodetect + validate on server)
//   - Settings > Workspace (picker + validate on save)
//
// isValidTimezone runs on the server (no browser Intl fallback list is
// safe on the server; we validate by constructing a DateTimeFormat and
// catching the RangeError Node throws on unknown IANA names).

// Short-list rendered as "Common" at the top of the Settings picker.
// Ordering matches how owners are most likely to think about their
// zones: India first (pilot market), then major English-speaking
// zones, then the middle-east + South East Asia hubs we see traffic
// from. The full IANA list is available via search underneath.
export const COMMON_TIMEZONES: { tz: string; label: string }[] = [
  { tz: "Asia/Kolkata",       label: "India — Kolkata" },
  { tz: "America/New_York",   label: "US East — New York" },
  { tz: "America/Chicago",    label: "US Central — Chicago" },
  { tz: "America/Denver",     label: "US Mountain — Denver" },
  { tz: "America/Los_Angeles",label: "US West — Los Angeles" },
  { tz: "Europe/London",      label: "UK — London" },
  { tz: "Europe/Berlin",      label: "Europe — Berlin" },
  { tz: "Asia/Dubai",         label: "UAE — Dubai" },
  { tz: "Asia/Singapore",     label: "Singapore" },
  { tz: "Australia/Sydney",   label: "Australia — Sydney" },
];

export function isValidTimezone(tz: string): boolean {
  if (!tz) return false;
  // Node & modern browsers both throw RangeError on unknown IANA names.
  // Constructing a formatter is the cheapest reliable check that also
  // works in the Edge runtime.
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// Full IANA list for the search-in-picker path. Prefer the runtime
// call when available (Node 18+, all modern browsers); fall back to
// the common shortlist so an old runtime doesn't render an empty
// picker.
export function allTimezones(): string[] {
  const supported =
    typeof Intl.supportedValuesOf === "function"
      ? Intl.supportedValuesOf("timeZone")
      : COMMON_TIMEZONES.map((t) => t.tz);
  return supported;
}
