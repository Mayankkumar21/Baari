"use client";

// Small country-code picker for mobile fields. Renders a flag + code
// button that opens a searchable dropdown. Common countries are
// hoisted to the top; everything else lives in an alphabetized list.
//
// Deliberately not a full international-phone-input library — those
// are heavy (300kb+) and try to validate every country's national
// format. Baari just wants a country code and lets the server-side
// E.164 validator do the rest. Total bundle cost: ~2kb.
//
// This file is "use client" because it defines a React component and
// the useCountry hook. Types, data, and pure helpers (countryByCode,
// countryFromMobile, defaultCountry, detectCountry) live in
// @/lib/country so server components (queue/page, book/page,
// search/page) can call them — importing a pure helper from a "use
// client" module crashes at runtime with "Attempted to call X from
// the server" per the Next 13+ RSC rule.

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ALL,
  COMMON,
  COUNTRIES,
  countryByCode,
  defaultCountry,
  detectCountry,
  type Country,
} from "@/lib/country";

// Re-exports for client callers that already import these from the
// picker (signup/login/forgot forms, queue-board, book-form). Keeps
// the churn small — new server-component callers import from
// @/lib/country directly.
export { COMMON, COUNTRIES, countryByCode, defaultCountry, detectCountry };
export type { Country };
export { countryFromMobile } from "@/lib/country";

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
