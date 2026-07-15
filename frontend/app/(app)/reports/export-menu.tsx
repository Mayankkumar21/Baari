"use client";

// Pro-tier "Download CSV" popover on Reports. Three flavours behind
// the same /api/export route — the route re-checks the plan gate so
// we never trust just the UI hide.

import { useState } from "react";
import { Download, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

const KINDS = [
  { key: "bookings", label: "Bookings", hint: "Every booking in this range" },
  { key: "customers", label: "Customers", hint: "All customers with visits + LTV" },
  { key: "revenue", label: "Revenue by day", hint: "Daily completed count + total" },
] as const;

export function ExportMenu({ from, to }: { from: string; to: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <Button variant="outline" size="sm" onClick={() => setOpen((v) => !v)}>
        <Download className="size-4" /> Export
        <ChevronDown className="size-3 opacity-60" />
      </Button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-2 w-64 overflow-hidden rounded-lg border border-border bg-card/95 shadow-xl backdrop-blur"
          onMouseLeave={() => setOpen(false)}
        >
          {KINDS.map((k) => (
            <a
              key={k.key}
              href={`/api/export?kind=${k.key}&from=${from}&to=${to}`}
              className="block border-b border-border/60 px-3 py-2 text-left last:border-0 hover:bg-secondary/60"
              onClick={() => setOpen(false)}
            >
              <div className="text-sm font-medium">{k.label}</div>
              <div className="text-[11px] text-muted-foreground">{k.hint}</div>
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}
