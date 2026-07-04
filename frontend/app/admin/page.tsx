// /admin — the overview page. KPI tiles + recent-signups feed +
// recent-bookings feed. Reads Neon directly. Filters out the admin's
// own "Baari HQ" workspace so it doesn't inflate active-workspace
// counts.

import Link from "next/link";
import { and, desc, eq, gte, inArray, isNull, notInArray, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { normalizeMobile } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { relTime } from "./_fmt";

export const dynamic = "force-dynamic";

// Admin workspaces are the ones whose OWNER row has a mobile on the
// ADMIN_MOBILES allowlist. We fetch those ids once and exclude them
// from every KPI + list so the operator's own placeholder workspace
// doesn't show up as a real customer.
async function loadAdminWorkspaceIds(): Promise<number[]> {
  const raw = process.env.ADMIN_MOBILES?.split(",")
    .map((s) => normalizeMobile(s))
    .filter((m): m is string => Boolean(m)) ?? [];
  if (raw.length === 0) return [];
  const rows = await db
    .select({ id: schema.users.clinicId })
    .from(schema.users)
    .where(inArray(schema.users.mobile, raw));
  const set = new Set<number>();
  for (const r of rows) set.add(r.id);
  return Array.from(set);
}

// Wrap a where-fragment builder to also exclude admin workspaces. The
// caller passes their own condition; we and-together with a NOT-IN if
// there's anything to exclude. Empty exclude list → no-op.
function excludeAdmins<T>(exclude: number[], colClinicId: T) {
  if (exclude.length === 0) return undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return notInArray(colClinicId as any, exclude);
}

async function loadKpis(excludeIds: number[]) {
  const now = new Date();
  const day = 24 * 60 * 60 * 1000;
  const sevenDaysAgo = new Date(now.getTime() - 7 * day);
  const oneDayAgo = new Date(now.getTime() - day);
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - 6);

  const clinicNotAdmin = excludeAdmins(excludeIds, schema.clinics.id);
  const bookingNotAdmin = excludeAdmins(excludeIds, schema.bookings.clinicId);
  const userNotAdmin = excludeAdmins(excludeIds, schema.users.clinicId);

  const [totalClinics] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.clinics)
    .where(clinicNotAdmin);

  // Active clinics = clinics with ≥1 booking in the last 7 days.
  const activeClinicsRows = await db
    .selectDistinct({ id: schema.bookings.clinicId })
    .from(schema.bookings)
    .where(
      and(
        gte(schema.bookings.createdAt, sevenDaysAgo),
        bookingNotAdmin,
      ),
    );
  const activeClinics = activeClinicsRows.length;

  const [todayBookings] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.bookings)
    .where(
      and(
        gte(schema.bookings.createdAt, startOfToday),
        bookingNotAdmin,
      ),
    );

  const [weekBookings] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.bookings)
    .where(
      and(
        gte(schema.bookings.createdAt, startOfWeek),
        bookingNotAdmin,
      ),
    );

  // Owner DAU — distinct owner users with last_login_at in the last
  // 24h. Excludes admin logins (that's you).
  const dauRows = await db
    .selectDistinct({ id: schema.users.id })
    .from(schema.users)
    .where(
      and(
        gte(schema.users.lastLoginAt, oneDayAgo),
        userNotAdmin,
      ),
    );
  const ownerDau = dauRows.length;

  // Customers signed up ever (as a proxy for real users). Rough.
  const [totalCustomers] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.customers)
    .where(isNull(schema.customers.deletedAt));

  return {
    totalClinics: totalClinics?.n ?? 0,
    activeClinics,
    todayBookings: todayBookings?.n ?? 0,
    weekBookings: weekBookings?.n ?? 0,
    ownerDau,
    totalCustomers: totalCustomers?.n ?? 0,
  };
}

async function loadRecentSignups(excludeIds: number[], limit = 8) {
  return await db
    .select({
      clinic: schema.clinics,
      user: schema.users,
    })
    .from(schema.clinics)
    .leftJoin(schema.users, eq(schema.users.clinicId, schema.clinics.id))
    .where(excludeAdmins(excludeIds, schema.clinics.id))
    .orderBy(desc(schema.clinics.createdAt))
    .limit(limit);
}

async function loadRecentBookings(excludeIds: number[], limit = 10) {
  return await db
    .select({
      booking: schema.bookings,
      clinic: schema.clinics,
      patient: schema.patients,
    })
    .from(schema.bookings)
    .innerJoin(schema.clinics, eq(schema.clinics.id, schema.bookings.clinicId))
    .leftJoin(schema.patients, eq(schema.patients.id, schema.bookings.patientId))
    .where(excludeAdmins(excludeIds, schema.bookings.clinicId))
    .orderBy(desc(schema.bookings.createdAt))
    .limit(limit);
}

export default async function AdminOverview() {
  const excludeIds = await loadAdminWorkspaceIds();
  const [kpis, signups, bookings] = await Promise.all([
    loadKpis(excludeIds),
    loadRecentSignups(excludeIds),
    loadRecentBookings(excludeIds),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
        <p className="text-sm text-muted-foreground pt-1">
          Live snapshot. Admin workspaces excluded from every count.
        </p>
      </div>

      {/* KPI tiles */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-6">
        <Kpi label="Workspaces" value={kpis.totalClinics} />
        <Kpi label="Active 7d" value={kpis.activeClinics} hint={`${percent(kpis.activeClinics, kpis.totalClinics)}% of total`} />
        <Kpi label="Bookings today" value={kpis.todayBookings} />
        <Kpi label="Bookings 7d" value={kpis.weekBookings} />
        <Kpi label="Owner DAU" value={kpis.ownerDau} />
        <Kpi label="Customers" value={kpis.totalCustomers} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="p-6 pb-3">
            <CardTitle>Recent signups</CardTitle>
            <p className="pt-1 text-xs text-muted-foreground">Newest workspaces first.</p>
          </CardHeader>
          <CardContent className="p-0">
            {signups.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">No signups yet.</div>
            ) : (
              <ul className="divide-y divide-border">
                {signups.map((s) => (
                  <li key={s.clinic.id} className="p-4 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <Link
                        href={`/admin/workspaces/${s.clinic.id}`}
                        className="text-sm font-medium truncate hover:text-primary"
                      >
                        {s.clinic.name}
                      </Link>
                      <div className="text-xs text-muted-foreground truncate">
                        {s.user?.name ?? "—"}{s.user?.mobile ? ` · ${s.user.mobile}` : ""} · {s.clinic.tenantType}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground shrink-0">
                      {relTime(s.clinic.createdAt)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-6 pb-3">
            <CardTitle>Recent bookings</CardTitle>
            <p className="pt-1 text-xs text-muted-foreground">Live feed across all workspaces.</p>
          </CardHeader>
          <CardContent className="p-0">
            {bookings.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">No bookings yet.</div>
            ) : (
              <ul className="divide-y divide-border">
                {bookings.map((b) => (
                  <li key={b.booking.id} className="p-4 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-sm truncate">
                        <span className="font-medium">T-{b.booking.token}</span>
                        <span className="text-muted-foreground"> · {b.patient?.name ?? "—"}</span>
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {b.clinic.name} · {b.booking.status}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground shrink-0">
                      {relTime(b.booking.createdAt)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</div>
        <div className="pt-1 text-2xl font-bold tracking-tight">{value.toLocaleString()}</div>
        {hint ? <div className="pt-0.5 text-[11px] text-muted-foreground">{hint}</div> : null}
      </CardContent>
    </Card>
  );
}

function percent(part: number, whole: number): number {
  if (!whole) return 0;
  return Math.round((part / whole) * 100);
}
