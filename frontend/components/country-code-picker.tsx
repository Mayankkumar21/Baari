"use client";

// Small country-code picker for mobile fields. Renders a flag + code
// button that opens a searchable dropdown. Common countries are
// hoisted to the top (based on the pilot markets we care about);
// everything else lives in an alphabetized list below.
//
// Deliberately not a full international-phone-input library — those
// are heavy (300kb+) and try to validate every country's national
// format. Baari just wants a country code and lets the server-side
// E.164 validator do the rest. Total bundle cost: ~2kb.

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

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
const COMMON: Country[] = [
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
const ALL: Country[] = [
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
//
// Previous version peeked at navigator.language, which is
// impossible on the server (returns fallback US) but works on the
// client (returns the browser's locale) — different value on each
// side of hydration → crash. This function now always returns
// India (COMMON[0]).
//
// If you want browser-locale detection, use `detectCountry()` in
// a `useEffect` — that only runs on the client, after hydration,
// and is safe.
export function defaultCountry(): Country {
  return COMMON[0]; // India
}

// Client-only: guess the user's country from browser signals. Timezone
// runs first because `Asia/Kolkata` unambiguously identifies India even
// when the browser locale is en-US (very common on Indian Macs — the
// exact bug that made region.ts add its own tz check). Falls back to
// the browser locale's ISO region.
//
// Final fallback is India — this is the pilot market and the majority
// of undetectable visitors are Indians on privacy tools / VPNs /
// mis-configured browsers. Non-Indian owners (US/UK/etc.) are almost
// always reliably detected via one of the two signals above, so the
// fallback rarely fires for them.
export function detectCountry(): Country {
  if (typeof window === "undefined") return COMMON[0];
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz === "Asia/Kolkata" || tz === "Asia/Calcutta") return COMMON[0]; // India
    const region = new Intl.Locale(navigator.language).region;
    if (region) {
      const match = COUNTRIES.find((c) => c.code === region);
      if (match) return match;
    }
  } catch {
    // ignore — some browsers throw on unknown locales
  }
  return COMMON[0]; // India
}

// Parse E.164 (+CC + national digits) into the matching Country. Used
// after login to pre-fill the picker with the owner's country: an
// owner who logged in with +1 415… gets +1 pre-selected when they
// add a walk-in, so they don't have to keep switching from the app-
// wide India default. Longest-dial-code-first so 971 wins over 9.
export function countryFromMobile(e164: string | null | undefined): Country | null {
  if (!e164) return null;
  const digits = e164.replace(/^\+/, "");
  const sorted = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
  for (const c of sorted) {
    if (digits.startsWith(c.dial)) return c;
  }
  return null;
}

// Country state for a form.
//
// - No preferredCode (login / signup / forgot — no session yet):
//   SSR renders India (deterministic → hydration-safe), then in a
//   useEffect swaps to detectCountry() so US/UK visitors don't stay
//   pinned at +91.
//
// - preferredCode passed (walk-in / book form / add-guest — inside
//   the app):  use the caller's choice, both on SSR and on client.
//   This is how we default the walk-in picker to the owner's own
//   country: page.tsx computes countryFromMobile(sess.user.mobile)
//   and passes the code down. No detection runs — the owner has
//   already told us, via their login credential, what country the
//   business is in.
export function useCountry(
  preferredCode?: string,
): readonly [Country, (c: Country) => void] {
  const [country, setCountry] = useState<Country>(() =>
    preferredCode ? countryByCode(preferredCode) ?? defaultCountry() : defaultCountry(),
  );
  useEffect(() => {
    if (preferredCode) return; // caller-controlled — skip detection.
    setCountry(detectCountry());
  }, [preferredCode]);
  return [country, setCountry] as const;
}

export function CountryCodePicker({
  value,
  onChange,
  className,
}: {
  value: Country;
  onChange: (c: Country) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on outside click. Keeps the popover feeling native.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null; // when empty, we render the COMMON/ALL split
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.dial.startsWith(q) ||
        c.code.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <div className={cn("relative", className)} ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex h-10 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-sm hover:bg-secondary/60"
      >
        <span className="text-base leading-none">{value.flag}</span>
        <span className="font-medium tabular-nums">+{value.dial}</span>
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </button>

      {open ? (
        <div className="absolute left-0 top-full z-30 mt-1 w-72 rounded-lg border border-border bg-popover shadow-xl">
          <div className="border-b border-border p-2">
            <div className="flex items-center gap-2 rounded-md border border-border bg-background px-2">
              <Search className="size-3.5 text-muted-foreground" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search country or code"
                className="h-8 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
          </div>
          <div className="max-h-72 overflow-y-auto py-1">
            {filtered ? (
              filtered.length === 0 ? (
                <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                  No match. Try a name or dialing code.
                </div>
              ) : (
                filtered.map((c) => (
                  <CountryRow
                    key={c.code}
                    country={c}
                    selected={c.code === value.code}
                    onPick={() => {
                      onChange(c);
                      setQuery("");
                      setOpen(false);
                    }}
                  />
                ))
              )
            ) : (
              <>
                <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Common
                </div>
                {COMMON.map((c) => (
                  <CountryRow
                    key={c.code}
                    country={c}
                    selected={c.code === value.code}
                    onPick={() => {
                      onChange(c);
                      setOpen(false);
                    }}
                  />
                ))}
                <div className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  All countries
                </div>
                {ALL.map((c) => (
                  <CountryRow
                    key={c.code}
                    country={c}
                    selected={c.code === value.code}
                    onPick={() => {
                      onChange(c);
                      setOpen(false);
                    }}
                  />
                ))}
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CountryRow({
  country,
  selected,
  onPick,
}: {
  country: Country;
  selected: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      className={cn(
        "flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm hover:bg-secondary/60",
        selected && "bg-primary/10",
      )}
    >
      <span className="text-base leading-none">{country.flag}</span>
      <span className="flex-1 truncate">{country.name}</span>
      <span className="text-muted-foreground tabular-nums">
        +{country.dial}
      </span>
    </button>
  );
}
