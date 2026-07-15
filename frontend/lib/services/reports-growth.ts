// Growth-tier reports: new-vs-returning split and silent-churn list.
//
// Kept in a separate module from the Free-tier `reports.ts` so the
// plan-gate can decide whether to even issue these queries. Both are
// single-round-trip SQL — no materialized views, no cron. Good enough
// at pilot scale; revisit when a workspace has >100k bookings and the
// GROUP BYs get expensive.

import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";

// New = patient's first COMPLETED booking (globally, not per range) is
// inside [from, to). Returning = they completed before too. Rows are
// bookings, not distinct patients — so if a returning patient came
// three times in the range they contribute 3 to `returningCount`. This
// mirrors how the owner reads it: "how many of my visits are repeat
// business?"
export type NewVsReturning = {
  newCount: number;
  returningCount: number;
  // Distinct-patient variants for the "how many people, not visits"
  // view. Same rule but COUNT DISTINCT patient_id.
  newPatients: number;
  returningPatients: number;
};

export async function loadNewVsReturning(
  clinicId: number,
  fromDate: string, // YYYY-MM-DD inclusive
  toDate: string,   // YYYY-MM-DD exclusive
): Promise<NewVsReturning> {
  // For every done booking, pull the patient's earliest completed_at
  // across ALL time. If earliest ∈ [from, to), it counts as new; else
  // returning. `completed_at` is timestamptz — cast to date for the
  // range comparison to avoid TZ drift at midnight IST.
  const [row] = await db.execute<{
    new_count: string;
    returning_count: string;
    new_patients: string;
    returning_patients: string;
  }>(sql`
    WITH first_visit AS (
      SELECT patient_id, MIN(completed_at) AS first_at
        FROM bookings
       WHERE clinic_id = ${clinicId}
         AND status = 'done'
       GROUP BY patient_id
    ),
    range_visits AS (
      SELECT b.id, b.patient_id,
             (fv.first_at::date >= ${fromDate}::date
              AND fv.first_at::date <  ${toDate}::date) AS is_new
        FROM bookings b
        JOIN first_visit fv ON fv.patient_id = b.patient_id
       WHERE b.clinic_id = ${clinicId}
         AND b.status    = 'done'
         AND b.date     >= ${fromDate}::date
         AND b.date     <  ${toDate}::date
    )
    SELECT
      COUNT(*) FILTER (WHERE is_new)          AS new_count,
      COUNT(*) FILTER (WHERE NOT is_new)      AS returning_count,
      COUNT(DISTINCT patient_id) FILTER (WHERE is_new)     AS new_patients,
      COUNT(DISTINCT patient_id) FILTER (WHERE NOT is_new) AS returning_patients
      FROM range_visits;
  `);
  return {
    newCount: Number(row?.new_count ?? 0),
    returningCount: Number(row?.returning_count ?? 0),
    newPatients: Number(row?.new_patients ?? 0),
    returningPatients: Number(row?.returning_patients ?? 0),
  };
}

// Silent-churn: customers who used to come regularly and haven't been
// back in a while. Three predicates so we don't flag first-timers or
// truly stale ex-customers:
//   1. At least 2 completed bookings ever  → they were regulars
//   2. Last completed booking > `staleDays` ago → they've gone quiet
//   3. Last completed booking within 12 months → they haven't fully
//      left the market (otherwise they're just old records)
// Rows are ordered by last visit (most recently ghosted first) — the
// owner acts on the top of the list.
export type SilentChurnRow = {
  patientId: number;
  name: string;
  mobile: string;
  visitCount: number;
  lastVisitAt: Date;
  daysSinceLastVisit: number;
};

export async function loadSilentChurn(
  clinicId: number,
  staleDays: number = 60,
  limit: number = 50,
): Promise<SilentChurnRow[]> {
  const rows = await db.execute<{
    patient_id: number;
    name: string;
    mobile: string;
    visit_count: string;
    last_visit_at: Date;
    days_since: string;
  }>(sql`
    SELECT p.id                                          AS patient_id,
           p.name                                        AS name,
           p.mobile                                      AS mobile,
           COUNT(b.id)                                   AS visit_count,
           MAX(b.completed_at)                           AS last_visit_at,
           EXTRACT(DAY FROM (NOW() - MAX(b.completed_at)))::int AS days_since
      FROM patients p
      JOIN bookings b ON b.patient_id = p.id
     WHERE p.clinic_id = ${clinicId}
       AND b.clinic_id = ${clinicId}
       AND b.status    = 'done'
     GROUP BY p.id, p.name, p.mobile
    HAVING COUNT(b.id) >= 2
       AND MAX(b.completed_at) < NOW() - (${staleDays} || ' days')::interval
       AND MAX(b.completed_at) > NOW() - INTERVAL '12 months'
     ORDER BY MAX(b.completed_at) DESC
     LIMIT ${limit};
  `);
  return rows.map((r) => ({
    patientId: r.patient_id,
    name: r.name,
    mobile: r.mobile,
    visitCount: Number(r.visit_count),
    lastVisitAt: r.last_visit_at,
    daysSinceLastVisit: Number(r.days_since),
  }));
}
