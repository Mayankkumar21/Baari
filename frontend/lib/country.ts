// Country types, data, and pure helpers. Server-safe (no "use client",
// no React, no browser APIs). Split out of components/country-code-picker
// so server components — queue/page, book/page, search/page — can call
// countryFromMobile() to compute the walk-in country default. Importing
// helpers from the picker file crashes at runtime because "use client"
// taints every named export ("Attempted to call countryFromMobile()
// from the server..." — Next 13+ RSC rule).
//
// detectCountry() lives here too even though it reads window/navigator:
// it early-returns on the server, so it's still safe to import from a
// server file — it just does nothing there. Keeping it colocated with
// the country data means one source of truth for the fallback logic.

export type Country = {
  code: string;   // ISO 3166-1 alpha-2, uppercase ("US", "IN")
  name: string;   // Display name
  dial: string;   // Dialing code without "+" ("1", "91", "44")
  flag: string;   // Emoji flag
};

// Common countries surfaced at the top of the picker — the markets
// we care about for the pilot + English-speaking + top global by
// mobile subscribers. India leads: this is an India-first market
// (₹ pricing, WhatsApp support number, home turf). Order also
// determines the default (COMMON[0]) when the picker mounts.
export const COMMON: Country[] = [
  { code: "IN", name: "India",           dial: "91",  flag: "🇮🇳" },
  { code: "US", name: "United States",   dial: "1",   flag: "🇺🇸" },
  { code: "GB", name: "United Kingdom",  dial: "44",  flag: "🇬🇧" },
  { code: "CA", name: "Canada",          dial: "1",   flag: "🇨🇦" },
  { code: "AU", name: "Australia",       dial: "61",  flag: "🇦🇺" },
  { code: "AE", name: "UAE",             dial: "971", flag: "🇦🇪" },
  { code: "SG", name: "Singapore",       dial: "65",  flag: "🇸🇬" },
];

// The full alphabetized list. Kept short but covers ~50 countries —
// enough for a worldwide pilot without bundling ITU's full table.
export const ALL: Country[] = [
  { code: "AR", name: "Argentina",       dial: "54",  flag: "🇦🇷" },
  { code: "AT", name: "Austria",         dial: "43",  flag: "🇦🇹" },
  { code: "BD", name: "Bangladesh",      dial: "880", flag: "🇧🇩" },
  { code: "BE", name: "Belgium",         dial: "32",  flag: "🇧🇪" },
  { code: "BR", name: "Brazil",          dial: "55",  flag: "🇧🇷" },
  { code: "CH", name: "Switzerland",     dial: "41",  flag: "🇨🇭" },
  { code: "CL", name: "Chile",           dial: "56",  flag: "🇨🇱" },
  { code: "CN", name: "China",           dial: "86",  flag: "🇨🇳" },
  { code: "CO", name: "Colombia",        dial: "57",  flag: "🇨🇴" },
  { code: "CZ", name: "Czech Republic",  dial: "420", flag: "🇨🇿" },
  { code: "DE", name: "Germany",         dial: "49",  flag: "🇩🇪" },
  { code: "DK", name: "Denmark",         dial: "45",  flag: "🇩🇰" },
  { code: "EG", name: "Egypt",           dial: "20",  flag: "🇪🇬" },
  { code: "ES", name: "Spain",           dial: "34",  flag: "🇪🇸" },
  { code: "FI", name: "Finland",         dial: "358", flag: "🇫🇮" },
  { code: "FR", name: "France",          dial: "33",  flag: "🇫🇷" },
  { code: "GR", name: "Greece",          dial: "30",  flag: "🇬🇷" },
  { code: "HK", name: "Hong Kong",       dial: "852", flag: "🇭🇰" },
  { code: "ID", name: "Indonesia",       dial: "62",  flag: "🇮🇩" },
  { code: "IE", name: "Ireland",         dial: "353", flag: "🇮🇪" },
  { code: "IL", name: "Israel",          dial: "972", flag: "🇮🇱" },
  { code: "IT", name: "Italy",           dial: "39",  flag: "🇮🇹" },
  { code: "JP", name: "Japan",           dial: "81",  flag: "🇯🇵" },
  { code: "KE", name: "Kenya",           dial: "254", flag: "🇰🇪" },
  { code: "KR", name: "South Korea",     dial: "82",  flag: "🇰🇷" },
  { code: "LK", name: "Sri Lanka",       dial: "94",  flag: "🇱🇰" },
  { code: "MA", name: "Morocco",         dial: "212", flag: "🇲🇦" },
  { code: "MX", name: "Mexico",          dial: "52",  flag: "🇲🇽" },
  { code: "MY", name: "Malaysia",        dial: "60",  flag: "🇲🇾" },
  { code: "NG", name: "Nigeria",         dial: "234", flag: "🇳🇬" },
  { code: "NL", name: "Netherlands",     dial: "31",  flag: "🇳🇱" },
  { code: "NO", name: "Norway",          dial: "47",  flag: "🇳🇴" },
  { code: "NP", name: "Nepal",           dial: "977", flag: "🇳🇵" },
  { code: "NZ", name: "New Zealand",     dial: "64",  flag: "🇳🇿" },
  { code: "PH", name: "Philippines",     dial: "63",  flag: "🇵🇭" },
  { code: "PK", name: "Pakistan",        dial: "92",  flag: "🇵🇰" },
  { code: "PL", name: "Poland",          dial: "48",  flag: "🇵🇱" },
  { code: "PT", name: "Portugal",        dial: "351", flag: "🇵🇹" },
  { code: "QA", name: "Qatar",           dial: "974", flag: "🇶🇦" },
  { code: "SA", name: "Saudi Arabia",    dial: "966", flag: "🇸🇦" },
  { code: "SE", name: "Sweden",          dial: "46",  flag: "🇸🇪" },
  { code: "TH", name: "Thailand",        dial: "66",  flag: "🇹🇭" },
  { code: "TR", name: "Turkey",          dial: "90",  flag: "🇹🇷" },
  { code: "TW", name: "Taiwan",          dial: "886", flag: "🇹🇼" },
  { code: "UA", name: "Ukraine",         dial: "380", flag: "🇺🇦" },
  { code: "VN", name: "Vietnam",         dial: "84",  flag: "🇻🇳" },
  { code: "ZA", name: "South Africa",    dial: "27",  flag: "🇿🇦" },
];

export const COUNTRIES = [...COMMON, ...ALL];

// Lookup by ISO code. Used by callers that persist the picked
// country across visits (e.g., signup form saves last-picked to
// localStorage).
export function countryByCode(code: string): Country | null {
  return COUNTRIES.find((c) => c.code === code) ?? null;
}

// Default country — DETERMINISTIC (India). Called at render time
// from `useState(() => defaultCountry())` all over the app; must
// return the same value on the server and the client, or React
// throws a hydration mismatch and shows the raw crash panel to
// the user mid-login.
export function defaultCountry(): Country {
  return COMMON[0]; // India
}

// Client-only detection: guess the user's country from browser
// signals. Timezone runs first because `Asia/Kolkata` unambiguously
// identifies India even when the browser locale is en-US (very
// common on Indian Macs). Falls back to the browser locale's ISO
// region. Final fallback is India (pilot market — most undetectable
// visitors are Indians on privacy tools).
//
// Safe to import from a server file: early-returns COMMON[0] when
// `window` is undefined so the module has no server-hostile side
// effects at import time.
export function detectCountry(): Country {
  if (typeof window === "undefined") return COMMON[0];
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz === "Asia/Kolkata" || tz === "Asia/Calcutta") return COMMON[0];
    const region = new Intl.Locale(navigator.language).region;
    if (region) {
      const match = COUNTRIES.find((c) => c.code === region);
      if (match) return match;
    }
  } catch {
    // ignore — some browsers throw on unknown locales
  }
  return COMMON[0];
}

// Parse E.164 (+CC + national digits) into the matching Country. Used
// after login to pre-fill the walk-in picker with the owner's country:
// an owner who logged in with +1 415… gets +1 pre-selected when they
// add a walk-in. Longest-dial-code-first so 971 wins over 9.
export function countryFromMobile(e164: string | null | undefined): Country | null {
  if (!e164) return null;
  const digits = e164.replace(/^\+/, "");
  const sorted = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
  for (const c of sorted) {
    if (digits.startsWith(c.dial)) return c;
  }
  return null;
}
