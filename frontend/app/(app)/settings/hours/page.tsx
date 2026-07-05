import { asc, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { requireDoctor } from "@/lib/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HoursForm } from "./hours-form";
import { ClosedDaysCard } from "./closed-days-card";

export const dynamic = "force-dynamic";

// Load future closed days ONLY. Past ones stay in the DB for audit but
// don't clutter the settings UI — we sort ascending so the next closure
// is at the top.
async function loadClosedDays(clinicId: number) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isoToday = today.toISOString().slice(0, 10);
  return await db
    .select()
    .from(schema.closedDays)
    .where(
      sql`${schema.closedDays.clinicId} = ${clinicId} AND ${schema.closedDays.date} >= ${isoToday}`,
    )
    .orderBy(asc(schema.closedDays.date));
}

export default async function HoursSettingsPage() {
  const sess = await requireDoctor();
  const openingHours =
    (sess.clinic.openingHours as Record<
      string,
      { open?: string; close?: string; closed?: boolean; open2?: string; close2?: string }
    >) ?? {};
  const closedDays = await loadClosedDays(sess.clinic.id);
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="p-6 pb-3">
          <CardTitle>Weekly hours</CardTitle>
          <p className="pt-1 text-xs text-muted-foreground">
            Use breaks for businesses with split shifts (e.g. lunch close).
          </p>
        </CardHeader>
        <CardContent className="p-6 pt-0">
          <HoursForm initial={openingHours} />
        </CardContent>
      </Card>

      <ClosedDaysCard
        initial={closedDays.map((d) => ({
          id: d.id,
          date: typeof d.date === "string" ? d.date : new Date(d.date).toISOString().slice(0, 10),
          reason: d.reason,
        }))}
      />
    </div>
  );
}
