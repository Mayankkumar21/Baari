// Region detection for pricing display. Single source of truth used
// by the hero micro-copy, PricingStrip on the landing, and TierGrid
// on /pricing so nobody sees a different price in two places.
//
// India-first market. Detection walks three signals in order:
//
//   1. Timezone (Intl.DateTimeFormat).
//      Asia/Kolkata or the legacy Asia/Calcutta name → India.
//      This is the STRONGEST signal — most Indian devices are on
//      Asia/Kolkata regardless of the browser language. This is
//      what catches the "en-US browser on a Mac in Bengaluru" case
//      that the old locale-only check missed.
//
//   2. Explicit region tag on navigator.language.
//      Something like "en-IN" or "hi-IN" → India.
//
//   3. Language starts with "hi" (Hindi).
//
// Anything else falls through to USD — the safer default for a
// global-facing landing that renders under SSR before the client
// can peek at navigator.
//
// SSR always returns GLOBAL because `navigator` doesn't exist on the
// server. Client components should render GLOBAL initially and swap
// to detected in a useEffect so the hydration payload stays stable.

export type Region = "IN" | "GLOBAL";

export function detectRegion(): Region {
  if (typeof navigator === "undefined") return "GLOBAL";
  try {
    // Timezone. Asia/Kolkata is the modern name; Asia/Calcutta the
    // legacy alias some devices still emit. Both are unambiguously
    // India.
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz === "Asia/Kolkata" || tz === "Asia/Calcutta") return "IN";

    // Language + region hint. Backup for the (rare) case where the
    // timezone is set to something else — e.g. a VPN user who's
    // routed through a non-India egress but has explicitly set their
    // browser to en-IN or hi.
    const loc = new Intl.Locale(navigator.language);
    const region = (loc as unknown as { region?: string }).region ?? "";
    if (region.toUpperCase() === "IN") return "IN";
    const tag = navigator.language.toLowerCase();
    if (tag.endsWith("-in") || tag.startsWith("hi")) return "IN";
  } catch {
    // Some browsers throw on unknown locales or missing timezone
    // data — treat as GLOBAL.
  }
  return "GLOBAL";
}
