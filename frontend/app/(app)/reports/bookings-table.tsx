"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { fmtDateTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { BookingRow } from "@/lib/services/reports";

type SortKey = "when" | "name" | "phone" | "token" | "service" | "status" | "duration";
type SortDir = "asc" | "desc";

const COLUMNS: { key: SortKey; label: string; align?: "left" | "right" }[] = [
  { key: "when", label: "When" },
  { key: "name", label: "Name" },
  { key: "phone", label: "Phone" },
  { key: "token", label: "Token", align: "right" },
  { key: "service", label: "Service" },
  { key: "status", label: "Status" },
  { key: "duration", label: "Duration", align: "right" },
];

function fmtMinutes(sec: number | null): string {
  if (sec == null) return "—";
  if (sec < 60) return `${sec}s`;
  return `${Math.round(sec / 60)}m`;
}

export function BookingsTable({ rows }: { rows: BookingRow[] }) {
  const [sort, setSort] = useState<SortKey>("when");
  const [dir, setDir] = useState<SortDir>("desc");

  const sorted = useMemo(() => {
    const mul = dir === "asc" ? 1 : -1;
    const out = [...rows];
    out.sort((a, b) => {
      const av = pick(a, sort);
      const bv = pick(b, sort);
      if (av === null && bv === null) return 0;
      if (av === null) return 1; // nulls last
      if (bv === null) return -1;
      if (av < bv) return -1 * mul;
      if (av > bv) return 1 * mul;
      return 0;
    });
    return out;
  }, [rows, sort, dir]);

  const toggleSort = (k: SortKey) => {
    if (sort === k) {
      setDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSort(k);
      setDir(k === "when" || k === "duration" || k === "token" ? "desc" : "asc");
    }
  };

  if (rows.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No bookings yet in this range. Your queue lights up when the first guest checks in.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card/40 backdrop-blur">
      <table className="w-full text-xs">
        <thead className="bg-secondary/40 text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
          <tr>
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                className={cn(
                  "select-none px-3 py-2.5 font-medium",
                  col.align === "right" ? "text-right" : "text-left",
                )}
              >
                <button
                  type="button"
                  onClick={() => toggleSort(col.key)}
                  className={cn(
                    "inline-flex items-center gap-1 hover:text-foreground",
                    sort === col.key ? "text-foreground" : "",
                  )}
                >
                  {col.label}
                  {sort === col.key ? (
                    dir === "asc" ? (
                      <ArrowUp className="size-3" />
                    ) : (
                      <ArrowDown className="size-3" />
                    )
                  ) : (
                    <ArrowUpDown className="size-3 opacity-40" />
                  )}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {sorted.map((r) => (
            <tr key={r.id} className="hover:bg-secondary/20">
              <td className="px-3 py-2 text-muted-foreground">{fmtDateTime(r.slotTime)}</td>
              <td className="px-3 py-2 font-medium">{r.patientName}</td>
              <td className="px-3 py-2 tabular-nums text-muted-foreground">
                {r.patientMobile}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">T{r.token}</td>
              <td className="px-3 py-2 text-muted-foreground">{r.reason ?? "—"}</td>
              <td className="px-3 py-2">
                <StatusPill status={r.status} />
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                {fmtMinutes(r.durationSec)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function pick(row: BookingRow, key: SortKey): string | number | null {
  switch (key) {
    case "when":
      return new Date(row.slotTime).getTime();
    case "name":
      return row.patientName.toLowerCase();
    case "phone":
      return row.patientMobile;
    case "token":
      return row.token;
    case "service":
      return (row.reason ?? "").toLowerCase();
    case "status":
      return row.status;
    case "duration":
      return row.durationSec;
  }
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === "done"
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-400/40"
      : status === "no_show"
        ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-400/40"
        : status === "cancelled"
          ? "bg-secondary/60 text-muted-foreground border-border"
          : status === "in_consult"
            ? "bg-primary/15 text-primary border-primary/40"
            : status === "checked_in"
              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-400/40"
              : "bg-secondary/60 text-muted-foreground border-border";
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize",
        tone,
      )}
    >
      {status.replace("_", " ")}
    </span>
  );
}
