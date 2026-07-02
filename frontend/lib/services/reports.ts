// Reports aggregator. Given a clinic and a [from, to) date range, returns a
// single bundle of numbers + arrays + a table-ready list for the page to
// render. One round-trip to Postgres per metric family to keep the report
// snappy on /reports even when the booking count grows.
import { and, asc, count, desc, eq, gte, lt, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";

const CLINIC_TZ = process.env.CLINIC_TZ ?? "Asia/Kolkata";

export type ReportsBundle = {
  totals: {
    bookings: number;
    completed: number;
    noShows: number;
    cancelled: number;
  };
  // Bookings by origin — app (customer self-serve incl. missed-call),
  // frontdesk (dashboard-created), walkin (walk-in flow). Powers the
  // owner's "where are my bookings coming from?" question.
  bySource: { app: number; frontdesk: number; walkin: number };
  noShowRate: number; // 0..1
  avgWaitSec: number | null;
  avgSessionSec: number | null;
  hourly: number[]; // length 24, count of bookings in each hour-bucket
  daysOfWeek: number[]; // length 7, [Mon, Tue, …, Sun]
  topServices: { name: string; count: number; pct: number }[];
  recent: BookingRow[];
};

export type BookingRow = {
  id: number;
  token: number;
  patientName: string;
  patientMobile: string;
  reason: string | null;
  status: string;
  // "app" | "frontdesk" | "walkin" — the origin badge in the table.
  source: string;
  slotTime: string; // ISO
  checkedInAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  durationSec: number | null;
};

export async function loadReports(
  clinicId: number,
  fromDate: string, // YYYY-MM-DD inclusive
  toDate: string, // YYYY-MM-DD exclusive
): Promise<ReportsBundle> {
  const where = and(
    eq(schema.bookings.clinicId, clinicId),
    gte(schema.bookings.date, fromDate),
    lt(schema.bookings.date, toDate),
  );

  // 1. Headline aggregates.
  const [agg] = await db
    .select({
      total: count(),
      done: sql<number>`count(*) filter (where ${schema.bookings.status} = 'done')`,
      noShow: sql<number>`count(*) filter (where ${schema.bookings.status} = 'no_show')`,
      cancelled: sql<number>`count(*) filter (where ${schema.bookings.status} = 'cancelled')`,
      // Counts by origin — one round-trip via FILTER predicates so we
      // don't need a second grouped query for the source breakdown.
      srcApp: sql<number>`count(*) filter (where ${schema.bookings.source} = 'app')`,
      srcFrontdesk: sql<number>`count(*) filter (where ${schema.bookings.source} = 'frontdesk')`,
      srcWalkin: sql<number>`count(*) filter (where ${schema.bookings.source} = 'walkin')`,
      avgWait: sql<number | null>`avg(extract(epoch from (${schema.bookings.startedAt} - ${schema.bookings.checkedInAt}))) filter (where ${schema.bookings.status} = 'done' and ${schema.bookings.startedAt} is not null and ${schema.bookings.checkedInAt} is not null)`,
      avgSession: sql<number | null>`avg(extract(epoch from (${schema.bookings.completedAt} - ${schema.bookings.startedAt}))) filter (where ${schema.bookings.status} = 'done' and ${schema.bookings.completedAt} is not null and ${schema.bookings.startedAt} is not null)`,
    })
    .from(schema.bookings)
    .where(where);

  const total = Number(agg?.total ?? 0);
  const done = Number(agg?.done ?? 0);
  const noShow = Number(agg?.noShow ?? 0);
  const cancelled = Number(agg?.cancelled ?? 0);
  // No-show rate is over rows that actually had a chance to consume the slot
  // (i.e. excluding cancellations) — otherwise a high-cancellation period
  // looks artificially low on no-shows.
  const denominator = total - cancelled;
  const noShowRate = denominator > 0 ? noShow / denominator : 0;

  // 2. Hourly distribution. Bucket by the hour of slot_time in clinic tz.
  const hourlyRows = await db
    .select({
      hour: sql<number>`extract(hour from (${schema.bookings.slotTime} at time zone ${CLINIC_TZ}))::int`,
      n: count(),
    })
    .from(schema.bookings)
    .where(where)
    .groupBy(sql`1`);
  const hourly = Array(24).fill(0) as number[];
  for (const r of hourlyRows) {
    const h = Number(r.hour);
    if (h >= 0 && h < 24) hourly[h] = Number(r.n);
  }

  // 3. Day-of-week distribution. Postgres' extract('dow') is 0=Sun..6=Sat;
  // remap to Mon-first so the chart reads naturally.
  const dowRows = await db
    .select({
      dow: sql<number>`extract(dow from ${schema.bookings.date})::int`,
      n: count(),
    })
    .from(schema.bookings)
    .where(where)
    .groupBy(sql`1`);
  const daysOfWeek = Array(7).fill(0) as number[];
  for (const r of dowRows) {
    const pgDow = Number(r.dow); // 0=Sun..6=Sat
    const monFirst = pgDow === 0 ? 6 : pgDow - 1;
    daysOfWeek[monFirst] = Number(r.n);
  }

  // 4. Top services (group by reason). Cancelled rows still count — the
  // owner wants to see service demand, not just delivered.
  const reasonRows = await db
    .select({
      reason: schema.bookings.reason,
      n: count(),
    })
    .from(schema.bookings)
    .where(where)
    .groupBy(schema.bookings.reason)
    .orderBy(desc(count()));
  const topServices = reasonRows
    .filter((r) => r.reason && r.reason.trim().length > 0)
    .slice(0, 6)
    .map((r) => ({
      name: r.reason as string,
      count: Number(r.n),
      pct: total > 0 ? Number(r.n) / total : 0,
    }));

  // 5. Recent bookings table — limit 200 newest by slot time. Pulled via a
  // patients join so we have name + mobile without N+1.
  const tableRows = await db
    .select({
      id: schema.bookings.id,
      token: schema.bookings.token,
      patientName: schema.patients.name,
      patientMobile: schema.patients.mobile,
      reason: schema.bookings.reason,
      status: schema.bookings.status,
      source: schema.bookings.source,
      slotTime: schema.bookings.slotTime,
      checkedInAt: schema.bookings.checkedInAt,
      startedAt: schema.bookings.startedAt,
      completedAt: schema.bookings.completedAt,
    })
    .from(schema.bookings)
    .innerJoin(schema.patients, eq(schema.bookings.patientId, schema.patients.id))
    .where(where)
    .orderBy(desc(schema.bookings.slotTime))
    .limit(200);

  const recent: BookingRow[] = tableRows.map((r) => ({
    id: r.id,
    token: r.token,
    patientName: r.patientName,
    patientMobile: r.patientMobile,
    reason: r.reason,
    status: r.status,
    source: r.source,
    slotTime: r.slotTime.toISOString(),
    checkedInAt: r.checkedInAt?.toISOString() ?? null,
    startedAt: r.startedAt?.toISOString() ?? null,
    completedAt: r.completedAt?.toISOString() ?? null,
    durationSec:
      r.completedAt && r.startedAt
        ? Math.round((r.completedAt.getTime() - r.startedAt.getTime()) / 1000)
        : null,
  }));

  return {
    totals: { bookings: total, completed: done, noShows: noShow, cancelled },
    bySource: {
      app: Number(agg?.srcApp ?? 0),
      frontdesk: Number(agg?.srcFrontdesk ?? 0),
      walkin: Number(agg?.srcWalkin ?? 0),
    },
    noShowRate,
    avgWaitSec: agg?.avgWait != null ? Math.round(Number(agg.avgWait)) : null,
    avgSessionSec: agg?.avgSession != null ? Math.round(Number(agg.avgSession)) : null,
    hourly,
    daysOfWeek,
    topServices,
    recent,
  };
}

// Lightweight aggregate for the previous-period comparison row — we only
// need the headline numbers, not the full table.
export type ReportsHeadline = {
  bookings: number;
  completed: number;
  noShows: number;
  cancelled: number;
  noShowRate: number;
  avgWaitSec: number | null;
  avgSessionSec: number | null;
};

export async function loadReportsHeadline(
  clinicId: number,
  fromDate: string,
  toDate: string,
): Promise<ReportsHeadline> {
  const where = and(
    eq(schema.bookings.clinicId, clinicId),
    gte(schema.bookings.date, fromDate),
    lt(schema.bookings.date, toDate),
  );
  const [agg] = await db
    .select({
      total: count(),
      done: sql<number>`count(*) filter (where ${schema.bookings.status} = 'done')`,
      noShow: sql<number>`count(*) filter (where ${schema.bookings.status} = 'no_show')`,
      cancelled: sql<number>`count(*) filter (where ${schema.bookings.status} = 'cancelled')`,
      avgWait: sql<number | null>`avg(extract(epoch from (${schema.bookings.startedAt} - ${schema.bookings.checkedInAt}))) filter (where ${schema.bookings.status} = 'done' and ${schema.bookings.startedAt} is not null and ${schema.bookings.checkedInAt} is not null)`,
      avgSession: sql<number | null>`avg(extract(epoch from (${schema.bookings.completedAt} - ${schema.bookings.startedAt}))) filter (where ${schema.bookings.status} = 'done' and ${schema.bookings.completedAt} is not null and ${schema.bookings.startedAt} is not null)`,
    })
    .from(schema.bookings)
    .where(where);
  const total = Number(agg?.total ?? 0);
  const done = Number(agg?.done ?? 0);
  const noShow = Number(agg?.noShow ?? 0);
  const cancelled = Number(agg?.cancelled ?? 0);
  const denom = total - cancelled;
  return {
    bookings: total,
    completed: done,
    noShows: noShow,
    cancelled,
    noShowRate: denom > 0 ? noShow / denom : 0,
    avgWaitSec: agg?.avgWait != null ? Math.round(Number(agg.avgWait)) : null,
    avgSessionSec: agg?.avgSession != null ? Math.round(Number(agg.avgSession)) : null,
  };
}
