"use client";

// Timezone picker for the workspace settings form. Mirrors the
// country-code picker's shape: a small trigger + a searchable
// dropdown; common zones surfaced at the top, everything else
// reachable via a search box. Writes to a hidden field named
// "timezone" that the saveWorkspace action reads.

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Clock, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { COMMON_TIMEZONES, allTimezones } from "@/lib/timezones";

export function TimezonePicker({
  name,
  initial,
}: {
  name: string;
  initial: string;
}) {
  const [value, setValue] = useState(initial);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const commonSet = useMemo(
    () => new Set(COMMON_TIMEZONES.map((t) => t.tz)),
    [],
  );
  const allTz = useMemo(() => allTimezones(), []);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return allTz
      .filter((tz) => tz.toLowerCase().includes(q))
      .slice(0, 80);
  }, [allTz, query]);

  const label =
    COMMON_TIMEZONES.find((t) => t.tz === value)?.label ?? value;

  return (
    <div className="relative" ref={rootRef}>
      <input type="hidden" name={name} value={value} />
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex h-10 w-full items-center gap-2 rounded-md border border-border bg-background px-3 text-sm hover:bg-secondary/60"
      >
        <Clock className="size-3.5 text-muted-foreground" />
        <span className="flex-1 truncate text-left">{label}</span>
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </button>

      {open ? (
        <div className="absolute left-0 top-full z-30 mt-1 w-full min-w-[280px] rounded-lg border border-border bg-popover shadow-xl">
          <div className="border-b border-border p-2">
            <div className="flex items-center gap-2 rounded-md border border-border bg-background px-2">
              <Search className="size-3.5 text-muted-foreground" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search city or region"
                className="h-8 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
          </div>
          <div className="max-h-72 overflow-y-auto py-1">
            {filtered ? (
              filtered.length === 0 ? (
                <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                  No match. Try a city name (e.g. Berlin, Tokyo).
                </div>
              ) : (
                filtered.map((tz) => (
                  <TzRow
                    key={tz}
                    tz={tz}
                    label={tz}
                    selected={tz === value}
                    onPick={() => {
                      setValue(tz);
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
                {COMMON_TIMEZONES.map((t) => (
                  <TzRow
                    key={t.tz}
                    tz={t.tz}
                    label={t.label}
                    selected={t.tz === value}
                    onPick={() => {
                      setValue(t.tz);
                      setOpen(false);
                    }}
                  />
                ))}
                {!commonSet.has(value) ? (
                  <>
                    <div className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Current
                    </div>
                    <TzRow
                      tz={value}
                      label={value}
                      selected
                      onPick={() => setOpen(false)}
                    />
                  </>
                ) : null}
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TzRow({
  tz,
  label,
  selected,
  onPick,
}: {
  tz: string;
  label: string;
  selected: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      className={cn(
        "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-secondary/60",
        selected && "bg-primary/10",
      )}
    >
      <span className="flex-1 truncate">{label}</span>
      {label !== tz ? (
        <span className="text-[10px] font-mono text-muted-foreground truncate">
          {tz}
        </span>
      ) : null}
    </button>
  );
}
