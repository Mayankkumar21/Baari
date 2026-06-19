import { and, eq, gte } from "drizzle-orm";
import { requireDoctor } from "@/lib/session";
import { db, schema } from "@/lib/db/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtDateTime } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const sess = await requireDoctor();

  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recent = await db
    .select()
    .from(schema.bookings)
    .where(and(eq(schema.bookings.clinicId, sess.clinic.id), gte(schema.bookings.createdAt, cutoff)));

  const totals = recent.reduce(
    (acc, r) => {
      acc.total++;
      if (r.status === "done") acc.done++;
      if (r.status === "no_show") acc.noShow++;
      if (r.status === "cancelled") acc.cancelled++;
      return acc;
    },
    { total: 0, done: 0, noShow: 0, cancelled: 0 },
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground">
          Rolling 30-day window. Per-day summaries land here once day-close is wired (see STATUS.md).
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total bookings", value: totals.total },
          { label: "Completed", value: totals.done },
          { label: "No-shows", value: totals.noShow },
          { label: "Cancelled", value: totals.cancelled },
        ].map((c) => (
          <Card key={c.label} className="relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
            <CardContent className="p-4">
              <div className="text-[10px] uppercase tracking-[0.06em] text-muted-foreground">{c.label}</div>
              <div className="mt-1 text-2xl font-bold">{c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="p-5 pb-3">
          <CardTitle>Recent bookings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 p-5 pt-0">
          {recent.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No bookings yet.
            </p>
          ) : (
            recent
              .slice(-12)
              .reverse()
              .map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between rounded-md border border-border bg-card/60 p-3 text-sm backdrop-blur"
                >
                  <div>
                    <div className="font-semibold">Token T{b.token}</div>
                    <div className="text-xs text-muted-foreground">
                      {fmtDateTime(b.slotTime)} · <span className="capitalize">{b.status.replace("_", " ")}</span>
                    </div>
                  </div>
                </div>
              ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
