import { ArrowDownRight, ArrowUpRight, Lock, Minus, UserPlus, Users } from "lucide-react";
import Link from "next/link";
import { requireDoctor } from "@/lib/session";
import { vocabFor } from "@/lib/vocab";
import { hasPlan } from "@/lib/plans";
import { Card, CardContent } from "@/components/ui/card";
import {
  loadReports,
  loadReportsHeadline,
  type ReportsHeadline,
} from "@/lib/services/reports";
import { loadNewVsReturning, loadSilentChurn } from "@/lib/services/reports-growth";
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

// Bare "new" hides whether the period saw 1 booking or 100. Spell out the
// count and add a tooltip so the owner doesn't have to guess.
function fmtPctDelta(
  now: number,
  prev: number,
): { label: string; tone: "up" | "down" | "neutral"; title?: string } {
  if (prev === 0 && now === 0) {
    return { label: "no data", tone: "neutral", title: "Nothing in this range yet." };
  }
  if (prev === 0) {
    return {
      label: `+${now} (new)`,
      tone: "up",
      title: "Nothing in the previous period to compare against — pure gain.",
    };
  }
  const delta = (now - prev) / prev;
  if (Math.abs(delta) < 0.01) {
    return { label: "no change", tone: "neutral", title: "Same as the previous period." };
  }
  const pct = Math.round(delta * 100);
  return {
    label: (pct > 0 ? "+" : "") + pct + "% vs prev",
    tone: pct > 0 ? "up" : "down",
    title: `Previous period: ${prev}. Now: ${now}.`,
  };
}

// "pp" (percentage points) is correct but esoteric. Use plain "% pts" with a
// tooltip that explains it in dollars-and-cents English.
function fmtRateDelta(now: number, prev: number) {
  const nowPct = Math.round(now * 1000) / 10;
  const prevPct = Math.round(prev * 1000) / 10;
  const diff = Math.round((now - prev) * 1000) / 10;
  if (Math.abs(diff) < 0.1) {
    return {
      label: "no change",
      tone: "neutral" as const,
      title: `Previous: ${prevPct}%. Now: ${nowPct}%.`,
    };
  }
  return {
    label: (diff > 0 ? "+" : "") + diff + "% pts",
    tone: diff > 0 ? ("up" as const) : ("down" as const),
    title: `Previous: ${prevPct}%. Now: ${nowPct}%.`,
  };
}

function fmtSecAvg(sec: number | null): string {
  if (sec == null) return "—";
  if (sec < 60) return `${sec}s`;
  return `${Math.round(sec / 60)}m`;
}

// Percentage rounded to the nearest whole number, "—" when the total is
// zero (nothing to divide by).
function pctOf(part: number, total: number): string {
  if (total <= 0) return "—";
  return Math.round((part / total) * 100) + "%";
}

// Revenue strip — only shown when the receptionist has typed an
// amount on at least one completed booking in the range. Three tiles:
// total, coverage (what fraction of completed had an amount tracked),
// and average ticket. Coverage matters because if it's low, the total
// is misleading.
function RevenueStrip({
  revenue,
}: {
  revenue: {
    totalInr: number;
    trackedCount: number;
    completedCount: number;
    avgTicketInr: number | null;
  };
}) {
  const coveragePct =
    revenue.completedCount > 0
      ? Math.round((revenue.trackedCount / revenue.completedCount) * 100)
      : 0;
  return (
    <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-widest text-emerald-700 dark:text-emerald-300">
          Revenue
        </div>
        <div className="text-[11px] text-muted-foreground">
          tracked on {revenue.trackedCount} of {revenue.completedCount} completed
          {revenue.completedCount > revenue.trackedCount
            ? ` — the ${revenue.completedCount - revenue.trackedCount} without an amount aren't included`
            : ""}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <div className="text-xs text-muted-foreground">Total</div>
          <div className="mt-1 text-2xl font-bold tabular-nums">
            ₹{revenue.totalInr.toLocaleString("en-IN")}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Coverage</div>
          <div className="mt-1 text-2xl font-bold tabular-nums">
            {coveragePct}%
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Avg ticket</div>
          <div className="mt-1 text-2xl font-bold tabular-nums">
            {revenue.avgTicketInr != null
              ? `₹${revenue.avgTicketInr.toLocaleString("en-IN")}`
              : "—"}
          </div>
        </div>
      </div>
    </div>
  );
}

// Empty state — first-run onboarding for the amount-tracking flow.
// Ships as a friendly nudge rather than a blank ₹0 which would read
// as "the tool is broken."
function RevenueEmpty() {
  return (
    <div className="rounded-lg border border-dashed border-border p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-lg">₹</div>
        <div className="flex-1">
          <div className="text-sm font-medium">Start tracking revenue</div>
          <p className="mt-1 text-xs text-muted-foreground">
            Type the amount paid when you tap <span className="font-semibold">Mark done</span>{" "}
            on the queue — Baari sums it into daily / weekly / monthly totals here.
          </p>
        </div>
      </div>
    </div>
  );
}

function SourceStrip({
  bySource,
  total,
  appEnabled,
}: {
  bySource: { app: number; frontdesk: number; walkin: number };
  total: number;
  // When the workspace has app bookings turned OFF and no historical
  // app rows sit in this range, we hide the App tile entirely rather
  // than showing a persistent "App: 0" that reads as a nudge for a
  // feature the owner deliberately disabled. Historical app bookings
  // stay visible even when disabled, so they can review their old
  // channel mix.
  appEnabled: boolean;
}) {
  const showApp = appEnabled || bySource.app > 0;
  const gridCols = showApp ? "grid-cols-3" : "grid-cols-2";
  return (
    <Card>
      <CardContent className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Bookings by source</h3>
          <span className="text-[11px] text-muted-foreground">
            {appEnabled
              ? "Where the bookings came from in this range"
              : "App bookings are off — hidden from this view"}
          </span>
        </div>
        <div className={"grid gap-3 " + gridCols}>
          {showApp ? (
            <SourceCell label="App" count={bySource.app} total={total} />
          ) : null}
          <SourceCell label="Front desk" count={bySource.frontdesk} total={total} />
          <SourceCell label="Walk-in" count={bySource.walkin} total={total} />
        </div>
      </CardContent>
    </Card>
  );
}

function NewVsReturningStrip({
  data,
}: {
  data: {
    newCount: number;
    returningCount: number;
    newPatients: number;
    returningPatients: number;
  };
}) {
  const totalVisits = data.newCount + data.returningCount;
  const returningPct =
    totalVisits > 0 ? Math.round((data.returningCount / totalVisits) * 100) : 0;
  return (
    <Card>
      <CardContent className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">New vs returning</h3>
          <span className="text-[11px] text-muted-foreground">
            Visits in this range — {returningPct}% are repeat business
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-md border border-border bg-card/40 p-3">
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
              <UserPlus className="size-3" /> New
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-semibold tabular-nums">
                {data.newCount}
              </span>
              <span className="text-xs text-muted-foreground">
                {data.newPatients === 1 ? "1 person" : `${data.newPatients} people`}
              </span>
            </div>
          </div>
          <div className="rounded-md border border-emerald-500/25 bg-emerald-500/5 p-3">
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.06em] text-emerald-700 dark:text-emerald-300">
              <Users className="size-3" /> Returning
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-semibold tabular-nums">
                {data.returningCount}
              </span>
              <span className="text-xs text-muted-foreground">
                {data.returningPatients === 1
                  ? "1 person"
                  : `${data.returningPatients} people`}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SilentChurnCard({
  rows,
  vocabPatient,
}: {
  rows: {
    patientId: number;
    name: string;
    mobile: string;
    visitCount: number;
    lastVisitAt: Date;
    daysSinceLastVisit: number;
  }[];
  vocabPatient: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Silent churn</h3>
          <span className="text-[11px] text-muted-foreground">
            Regulars who haven&apos;t been back in 60+ days
          </span>
        </div>
        {rows.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
            No silent churn — every returning {vocabPatient} has been in recently.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                <tr>
                  <th className="pb-2 text-left font-medium">Name</th>
                  <th className="pb-2 text-left font-medium">Mobile</th>
                  <th className="pb-2 text-right font-medium">Visits</th>
                  <th className="pb-2 text-right font-medium">Last visit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {rows.map((r) => (
                  <tr key={r.patientId} className="text-sm">
                    <td className="py-2 font-medium">{r.name}</td>
                    <td className="py-2 tabular-nums text-muted-foreground">
                      {r.mobile}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {r.visitCount}
                    </td>
                    <td className="py-2 text-right tabular-nums text-muted-foreground">
                      {r.daysSinceLastVisit}d ago
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function GrowthLocked({ title, body }: { title: string; body: string }) {
  return (
    <Card className="border-dashed">
      <CardContent className="p-5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            <Lock className="size-4" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">{title}</h3>
              <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-primary">
                Growth
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{body}</p>
            <Link
              href="/pricing"
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              See plans
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SourceCell({
  label,
  count,
  total,
}: {
  label: string;
  count: number;
  total: number;
}) {
  return (
    <div className="rounded-md border border-border bg-card/40 p-3">
      <div className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-semibold tabular-nums">{count}</span>
        <span className="text-xs text-muted-foreground">{pctOf(count, total)}</span>
      </div>
    </div>
  );
}

function fmtSecDelta(now: number | null, prev: number | null) {
  if (now == null || prev == null || prev === 0) {
    // Mirror the string fmtPctDelta uses so every "no comparison
    // possible" cell reads the same across the reports grid — no more
    // "— —" next to "— no data".
    return { label: "no data", tone: "neutral" as const, title: "Nothing in this range yet." };
  }
  const delta = Math.round(((now - prev) / prev) * 100);
  if (Math.abs(delta) < 1) {
    return {
      label: "no change",
      tone: "neutral" as const,
      title: "Same as the previous period.",
    };
  }
  return {
    label: (delta > 0 ? "+" : "") + delta + "% vs prev",
    tone: delta > 0 ? ("up" as const) : ("down" as const),
    title: `Previous period: ${prev}s. Now: ${now}s.`,
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
  delta: { label: string; tone: DeltaTone; title?: string };
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
          title={delta.title}
          className={cn(
            "mt-1 inline-flex items-center gap-1 text-[11px] font-medium",
            delta.title && "cursor-help",
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

  const growthUnlocked = hasPlan(sess.clinic, "growth");
  const [bundle, prev, newVsRet, churn] = await Promise.all([
    loadReports(sess.clinic.id, r.from, r.to),
    loadReportsHeadline(sess.clinic.id, r.prevFrom, r.prevTo),
    // Only issue the Growth queries if the effective plan allows — no
    // point spending a round-trip on numbers we'd render blurred behind
    // a paywall.
    growthUnlocked
      ? loadNewVsReturning(sess.clinic.id, r.from, r.to)
      : Promise.resolve(null),
    growthUnlocked
      ? loadSilentChurn(sess.clinic.id, 60, 25)
      : Promise.resolve(null),
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

      {/* Revenue strip — only shown when at least one booking in the
          range had an amount tracked, otherwise it'd render ₹0 and
          look broken. */}
      {bundle.revenue.trackedCount > 0 ? (
        <RevenueStrip revenue={bundle.revenue} />
      ) : (
        <RevenueEmpty />
      )}

      {/* Bookings by source — small strip so the owner can spot how
          much of their volume is customer self-serve vs desk-created. */}
      <SourceStrip
        bySource={bundle.bySource}
        total={bundle.totals.bookings}
        appEnabled={sess.clinic.acceptAppBookings}
      />

      {/* Growth-tier: new-vs-returning strip. Rendered even when locked
          so the owner sees what they'd unlock — the numbers themselves
          are hidden behind the paywall CTA. */}
      {growthUnlocked ? (
        <NewVsReturningStrip data={newVsRet!} />
      ) : (
        <GrowthLocked
          title="New vs returning customers"
          body="See how many of this period's visits are repeat business — and how many are brand-new faces."
        />
      )}

      {/* Growth-tier: silent-churn list. Regulars who've gone quiet.
          One of the highest-leverage owner surfaces we've built — a
          $5 message to a churned regular is worth 100 cold acquires. */}
      {growthUnlocked ? (
        <SilentChurnCard rows={churn!} vocabPatient={vocab.entitySingular} />
      ) : (
        <GrowthLocked
          title="Silent-churn list"
          body="Which regulars haven't been back in 60 days? One WhatsApp is often enough to bring them in."
        />
      )}

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
