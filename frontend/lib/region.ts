// Region detection for pricing display. Single source of truth used
// by the hero micro-copy, PricingStrip on the landing, and TierGrid
// on /pricing so nobody sees a different price in two places.
//
// India-first market. Anything that reads as Indian (region "IN" via
// Intl.Locale, or the language tag ends in "-in", or starts with
// "hi") gets INR. Everything else falls through to USD — the safer
// default for a global-facing landing that renders under SSR before
// the client can peek at navigator.

export type Region = "IN" | "GLOBAL";

export function detectRegion(): Region {
  if (typeof navigator === "undefined") return "GLOBAL";
  try {
    const loc = new Intl.Locale(navigator.language);
    const region = (loc as unknown as { region?: string }).region ?? "";
    if (region.toUpperCase() === "IN") return "IN";
    const tag = navigator.language.toLowerCase();
    if (tag.endsWith("-in") || tag.startsWith("hi")) return "IN";
  } catch {
    // Some browsers throw on unknown locales — treat as GLOBAL.
  }
  return "GLOBAL";
}
