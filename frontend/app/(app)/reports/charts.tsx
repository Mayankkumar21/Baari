import { cn } from "@/lib/utils";

// Compact CSS bar charts — no chart library required, no runtime JS,
// no client component. Bars are rendered via inline percentage widths
// which makes them legible at all viewport sizes.

const HOUR_LABELS = Array.from({ length: 24 }, (_, h) => {
  const pad = String(h).padStart(2, "0");
  return `${pad}`;
});

const DOW_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function safeMax(arr: number[]): number {
  const m = arr.reduce((a, b) => Math.max(a, b), 0);
  return m === 0 ? 1 : m;
}

export function HourlyChart({ data }: { data: number[] }) {
  const max = safeMax(data);
  const peak = data.indexOf(max);
  const hasData = data.some((n) => n > 0);
  return (
    <div>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Hourly distribution</h3>
        {hasData ? (
          <div className="text-[11px] text-muted-foreground">
            Peak: <span className="font-semibold text-foreground">{HOUR_LABELS[peak]}:00</span>
          </div>
        ) : null}
      </div>
      <div
        className="mt-3 grid gap-1"
        style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }}
      >
        {data.map((n, h) => {
          const pct = Math.round((n / max) * 100);
          const isPeak = hasData && h === peak;
          return (
            <div key={h} className="flex flex-col items-center">
              <div className="relative h-24 w-full">
                <div
                  style={{ height: `${Math.max(2, pct)}%` }}
                  className={cn(
                    "absolute bottom-0 left-0 right-0 rounded-sm transition-all",
                    isPeak
                      ? "bg-primary"
                      : n > 0
                        ? "bg-primary/40"
                        : "bg-border/40",
                  )}
                  title={`${HOUR_LABELS[h]}:00 — ${n} booking${n === 1 ? "" : "s"}`}
                />
              </div>
              <div className="mt-1 text-[9px] tabular-nums text-muted-foreground">
                {h % 3 === 0 ? HOUR_LABELS[h] : ""}
              </div>
            </div>
          );
        })}
      </div>
      {!hasData ? (
        <p className="mt-3 text-center text-xs text-muted-foreground">
          No bookings in this range.
        </p>
      ) : null}
    </div>
  );
}

export function DayOfWeekChart({ data }: { data: number[] }) {
  const max = safeMax(data);
  const peak = data.indexOf(max);
  const hasData = data.some((n) => n > 0);
  return (
    <div>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Busiest days</h3>
        {hasData ? (
          <div className="text-[11px] text-muted-foreground">
            Peak: <span className="font-semibold text-foreground">{DOW_LABELS[peak]}</span>
          </div>
        ) : null}
      </div>
      <div className="mt-3 space-y-1.5">
        {DOW_LABELS.map((label, i) => {
          const n = data[i];
          const pct = Math.round((n / max) * 100);
          const isPeak = hasData && i === peak;
          return (
            <div key={label} className="grid grid-cols-[44px_1fr_36px] items-center gap-3">
              <div className="text-xs font-medium text-muted-foreground">{label}</div>
              <div className="relative h-2.5 overflow-hidden rounded-full bg-secondary/40">
                <div
                  style={{ width: `${Math.max(2, pct)}%` }}
                  className={cn(
                    "h-full rounded-full transition-all",
                    isPeak ? "bg-primary" : n > 0 ? "bg-primary/40" : "bg-transparent",
                  )}
                />
              </div>
              <div className="text-right text-xs tabular-nums">{n}</div>
            </div>
          );
        })}
      </div>
      {!hasData ? (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          No bookings in this range.
        </p>
      ) : null}
    </div>
  );
}

export function ServicesChart({
  data,
}: {
  data: { name: string; count: number; pct: number }[];
}) {
  if (data.length === 0) {
    return (
      <p className="text-center text-xs text-muted-foreground">
        Nothing booked yet in this range.
      </p>
    );
  }
  const max = Math.max(...data.map((s) => s.count), 1);
  return (
    <div className="space-y-2">
      {data.map((s) => {
        const pct = Math.round((s.count / max) * 100);
        return (
          <div key={s.name} className="space-y-0.5">
            <div className="flex items-center justify-between text-xs">
              <span className="truncate font-medium">{s.name}</span>
              <span className="text-muted-foreground">
                {s.count} · {Math.round(s.pct * 100)}%
              </span>
            </div>
            <div className="relative h-1.5 overflow-hidden rounded-full bg-secondary/40">
              <div
                style={{ width: `${Math.max(3, pct)}%` }}
                className="h-full rounded-full bg-primary/60"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
