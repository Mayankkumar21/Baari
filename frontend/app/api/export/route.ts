// Pro-tier CSV export. Gated by session cookie (middleware handles that)
// and by plan (assertPlan below). Three flavours behind `?kind=`:
//   bookings — one row per booking in the range
//   customers — one row per patient with visit count + LTV
//   revenue — one row per calendar date with totals
//
// Range comes from ?from&to (YYYY-MM-DD). Output is UTF-8 text/csv with
// a Content-Disposition attachment name that includes the workspace
// slug + kind + range so the owner ends up with a legible download.

import { and, eq, gte, lt, sum, count, sql, desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db/client";
import { requireSession } from "@/lib/session";
import { assertPlan, PlanRequiredError } from "@/lib/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Kind = "bookings" | "customers" | "revenue";

function csvEscape(value: unknown): string {
  if (value == null) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(header: string[], rows: unknown[][]): string {
  const head = header.map(csvEscape).join(",");
  const body = rows.map((r) => r.map(csvEscape).join(",")).join("\n");
  return head + "\n" + body + "\n";
}

function fmtDateStr(d: Date | null): string {
  if (!d) return "";
  return d.toISOString().slice(0, 19).replace("T", " ");
}

export async function GET(req: Request) {
  const sess = await requireSession();
  try {
    assertPlan(sess.clinic, "pro");
  } catch (e) {
    if (e instanceof PlanRequiredError) {
      return NextResponse.json(
        { error: e.message, code: "PLAN_REQUIRED", required: e.required },
        { status: 402 },
      );
    }
    throw e;
  }

  const url = new URL(req.url);
  const kind = (url.searchParams.get("kind") ?? "bookings") as Kind;
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return NextResponse.json(
      { error: "from/to required as YYYY-MM-DD" },
      { status: 400 },
    );
  }
  if (!["bookings", "customers", "revenue"].includes(kind)) {
    return NextResponse.json({ error: "unknown kind" }, { status: 400 });
  }

  const filename = `${sess.clinic.slug ?? "workspace"}-${kind}-${from}-${to}.csv`;

  let csv = "";
  if (kind === "bookings") {
    const rows = await db
      .select({
        id: schema.bookings.id,
        date: schema.bookings.date,
        token: schema.bookings.token,
        slotTime: schema.bookings.slotTime,
        status: schema.bookings.status,
        source: schema.bookings.source,
        name: schema.patients.name,
        mobile: schema.patients.mobile,
        reason: schema.bookings.reason,
        amountPaidInr: schema.bookings.amountPaidInr,
        checkedInAt: schema.bookings.checkedInAt,
        startedAt: schema.bookings.startedAt,
        completedAt: schema.bookings.completedAt,
      })
      .from(schema.bookings)
      .innerJoin(schema.patients, eq(schema.patients.id, schema.bookings.patientId))
      .where(
        and(
          eq(schema.bookings.clinicId, sess.clinic.id),
          gte(schema.bookings.date, from),
          lt(schema.bookings.date, to),
        ),
      )
      .orderBy(desc(schema.bookings.slotTime));
    csv = toCsv(
      [
        "id",
        "date",
        "token",
        "slot_time",
        "status",
        "source",
        "name",
        "mobile",
        "reason",
        "amount_paid_inr",
        "checked_in_at",
        "started_at",
        "completed_at",
      ],
      rows.map((r) => [
        r.id,
        r.date,
        r.token,
        fmtDateStr(r.slotTime),
        r.status,
        r.source,
        r.name,
        r.mobile,
        r.reason ?? "",
        r.amountPaidInr ?? "",
        fmtDateStr(r.checkedInAt),
        fmtDateStr(r.startedAt),
        fmtDateStr(r.completedAt),
      ]),
    );
  } else if (kind === "customers") {
    // Aggregate ever, not just in-range — the customers export is a
    // "who are my regulars" list, not a period snapshot. In-range
    // slicing is what /export?kind=bookings is for.
    const rows = await db.execute<{
      id: number;
      name: string;
      mobile: string;
      visits: string;
      first_visit_at: Date | null;
      last_visit_at: Date | null;
      ltv_inr: string | null;
    }>(sql`
      SELECT p.id,
             p.name,
             p.mobile,
             COUNT(b.id) FILTER (WHERE b.status = 'done')            AS visits,
             MIN(b.completed_at)                                     AS first_visit_at,
             MAX(b.completed_at)                                     AS last_visit_at,
             SUM(b.amount_paid_inr)                                  AS ltv_inr
        FROM patients p
        LEFT JOIN bookings b ON b.patient_id = p.id AND b.clinic_id = ${sess.clinic.id}
       WHERE p.clinic_id = ${sess.clinic.id}
       GROUP BY p.id, p.name, p.mobile
       ORDER BY p.name;
    `);
    csv = toCsv(
      ["id", "name", "mobile", "visits", "first_visit_at", "last_visit_at", "ltv_inr"],
      rows.map((r) => [
        r.id,
        r.name,
        r.mobile,
        Number(r.visits ?? 0),
        fmtDateStr(r.first_visit_at),
        fmtDateStr(r.last_visit_at),
        r.ltv_inr ?? "",
      ]),
    );
  } else {
    // revenue: one row per calendar date in the range.
    const rows = await db
      .select({
        date: schema.bookings.date,
        completed: count(),
        totalInr: sum(schema.bookings.amountPaidInr),
      })
      .from(schema.bookings)
      .where(
        and(
          eq(schema.bookings.clinicId, sess.clinic.id),
          eq(schema.bookings.status, "done"),
          gte(schema.bookings.date, from),
          lt(schema.bookings.date, to),
        ),
      )
      .groupBy(schema.bookings.date)
      .orderBy(schema.bookings.date);
    csv = toCsv(
      ["date", "completed_bookings", "total_revenue_inr"],
      rows.map((r) => [r.date, r.completed, r.totalInr ?? ""]),
    );
  }

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
