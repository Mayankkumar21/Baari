"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";

const OPTIONS: { key: "today" | "7d" | "30d"; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
];

export function RangeSelector({ current }: { current: "today" | "7d" | "30d" | "custom" }) {
  const path = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [customOpen, setCustomOpen] = useState(current === "custom");
  const initialFrom = searchParams.get("from") ?? "";
  const initialTo = searchParams.get("to") ?? "";

  const buildHref = (key: string) =>
    `${path}?${new URLSearchParams({ range: key }).toString()}`;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <div className="inline-flex rounded-md border border-border bg-card/60 p-0.5 backdrop-blur">
        {OPTIONS.map((opt) => (
          <Link
            key={opt.key}
            href={buildHref(opt.key)}
            className={cn(
              "rounded px-3 py-1.5 text-xs font-medium transition-all",
              current === opt.key
                ? "bg-primary/15 text-foreground shadow-[0_0_0_1px_hsl(var(--primary)/0.5)]"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {opt.label}
          </Link>
        ))}
        <button
          type="button"
          onClick={() => setCustomOpen((v) => !v)}
          className={cn(
            "rounded px-3 py-1.5 text-xs font-medium transition-all",
            current === "custom"
              ? "bg-primary/15 text-foreground shadow-[0_0_0_1px_hsl(var(--primary)/0.5)]"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Custom
        </button>
      </div>

      {customOpen ? (
        <form
          action={(fd) => {
            const from = String(fd.get("from") ?? "");
            const to = String(fd.get("to") ?? "");
            if (!from || !to) return;
            router.push(
              `${path}?${new URLSearchParams({ range: "custom", from, to }).toString()}`,
            );
          }}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card/60 p-0.5 backdrop-blur"
        >
          <input
            name="from"
            type="date"
            defaultValue={initialFrom}
            className="h-7 rounded bg-transparent px-2 text-xs"
            required
          />
          <span className="text-[10px] text-muted-foreground">→</span>
          <input
            name="to"
            type="date"
            defaultValue={initialTo}
            className="h-7 rounded bg-transparent px-2 text-xs"
            required
          />
          <button
            type="submit"
            className="rounded bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground hover:brightness-110"
          >
            Apply
          </button>
        </form>
      ) : null}
    </div>
  );
}
