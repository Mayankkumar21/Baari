import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { requireDoctor } from "@/lib/session";
import { vocabFor } from "@/lib/vocab";
import { Card, CardContent } from "@/components/ui/card";
import {
  loadReports,
  loadReportsHeadline,
  type ReportsHeadline,
} from "@/lib/services/reports";
import { computeRange } from "@/lib/reports-range";
import { cn } from "@/lib/utils";
import { RangeSelector } from "./range-selector";
import { BookingsTable } from "./bookings-table";
import {
  DayOfWeekChart,
  HourlyChart,
  ServicesChart,
} from "./charts";

// Snap to ~60s freshness so refreshes are cheap.
export const revalidate = 60;

function fmtPctDelta(now: number, prev: number): {
  label: string;
  tone: "up" | "down" | "neutral";
} {
  if (prev === 0 && now === 0) return { label: "—", tone: "neutral" };
  if (prev === 0) return { label: "new", tone: "up" };
  const delta = (now - prev) / prev;
  if (Math.abs(delta) < 0.01) return { label: "0%", tone: "neutral" };
  const pct = Math.round(delta * 100);
  return {
    label: (pct > 0 ? "+" : "") + pct + "%",
    tone: pct > 0 ? "up" : "down",
  };
}

function fmtRateDelta(now: number, prev: number) {
  const diff = Math.round((now - prev) * 1000) / 10; // percentage points
  if (Math.abs(diff) < 0.1) return { label: "0pp", tone: "neutral" as const };
  return {
    label: (diff > 0 ? "+" : "") + diff + "pp",
    tone: diff > 0 ? ("up" as const) : ("down" as const),
  };
}

function fmtSecAvg(sec: number | null): string {
  if (sec == null) return "—";
  if (sec < 60) return `${sec}s`;
  return `${Math.round(sec / 60)}m`;
}

function fmtSecDelta(now: number | null, prev: number | null) {
  if (now == null || prev == null || prev === 0) {
    return { label: "—", tone: "neutral" as const };
  }
  const delta = Math.round(((now - prev) / prev) * 100);
  if (Math.abs(delta) < 1) return { label: "0%", tone: "neutral" as const };
  return {
    label: (delta > 0 ? "+" : "") + delta + "%",
    tone: delta > 0 ? ("up" as const) : ("down" as const),
  };
}

type DeltaTone = "up" | "down" | "neutral";

function Kpi({
  label,
  value,
  delta,
  invertColor,
}: {
  label: string;
  value: string;
  delta: { label: string; tone: DeltaTone };
  // For metrics where "up" is bad (no-show rate, wait time), flip the color.
  invertColor?: boolean;
}) {
  const tone: DeltaTone =
    invertColor && delta.tone === "up"
      ? "down"
      : invertColor && delta.tone === "down"
        ? "up"
        : delta.tone;
  const Icon = delta.tone === "up" ? ArrowUpRight : delta.tone === "down" ? ArrowDownRight : Minus;
  return (
    <Card className="relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
      <CardContent className="p-4">
        <div className="text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
          {label}
        </div>
        <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
        <div
          className={cn(
            "mt-1 inline-flex items-center gap-1 text-[11px] font-medium",
            tone === "up" && "text-emerald-600 dark:text-emerald-400",
            tone === "down" && "text-rose-600 dark:text-rose-400",
            tone === "neutral" && "text-muted-foreground",
          )}
        >
          <Icon className="size-3" />
          {delta.label}
        </div>
      </CardContent>
    </Card>
  );
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const sess = await requireDoctor();
  const vocab = vocabFor(sess.clinic.tenantType);
  const sp = await searchParams;
  const r = computeRange(sp.range, sp.from, sp.to);

  const [bundle, prev] = await Promise.all([
    loadReports(sess.clinic.id, r.from, r.to),
    loadReportsHeadline(sess.clinic.id, r.prevFrom, r.prevTo),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
          <p className="text-sm text-muted-foreground">
            {r.label} · {r.dateLabel}
          </p>
        </div>
        <RangeSelector current={r.range} />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi
          label="Total bookings"
          value={String(bundle.totals.bookings)}
          delta={fmtPctDelta(bundle.totals.bookings, prev.bookings)}
        />
        <Kpi
          label="Completed"
          value={String(bundle.totals.completed)}
          delta={fmtPctDelta(bundle.totals.completed, prev.completed)}
        />
        <Kpi
          label="No-show rate"
          value={(Math.round(bundle.noShowRate * 1000) / 10).toFixed(1) + "%"}
          delta={fmtRateDelta(bundle.noShowRate, prev.noShowRate)}
          invertColor
        />
        <Kpi
          label="Cancelled"
          value={String(bundle.totals.cancelled)}
          delta={fmtPctDelta(bundle.totals.cancelled, prev.cancelled)}
          invertColor
        />
        <Kpi
          label="Avg wait"
          value={fmtSecAvg(bundle.avgWaitSec)}
          delta={fmtSecDelta(bundle.avgWaitSec, prev.avgWaitSec)}
          invertColor
        />
        <Kpi
          label="Avg session"
          value={fmtSecAvg(bundle.avgSessionSec)}
          delta={fmtSecDelta(bundle.avgSessionSec, prev.avgSessionSec)}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardContent className="p-5">
            <HourlyChart data={bundle.hourly} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <DayOfWeekChart data={bundle.daysOfWeek} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
        <Card>
          <CardContent className="p-5">
            <h3 className="mb-3 text-sm font-semibold">
              Top {vocab.sessionTitled.toLowerCase()}s
            </h3>
            <ServicesChart data={bundle.topServices} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Bookings</h3>
              <span className="text-[11px] text-muted-foreground">
                Showing {bundle.recent.length} {bundle.recent.length === 200 ? "(capped)" : ""}
              </span>
            </div>
            <BookingsTable rows={bundle.recent} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
