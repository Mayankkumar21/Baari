// /admin/workspaces/[id] — workspace deep-dive.
// Full detail: owner, hours, services, live queue snapshot, recent
// bookings, audit log entries.

import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtDate, fmtDateTime, relTime } from "../../_fmt";

export const dynamic = "force-dynamic";

async function loadDetail(id: number) {
  const [clinic] = await db
    .select()
    .from(schema.clinics)
    .where(eq(schema.clinics.id, id))
    .limit(1);
  if (!clinic) return null;

  const owners = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.clinicId, id));

  const recentBookings = await db
    .select({
      booking: schema.bookings,
      patient: schema.patients,
    })
    .from(schema.bookings)
    .leftJoin(schema.patients, eq(schema.patients.id, schema.bookings.patientId))
    .where(eq(schema.bookings.clinicId, id))
    .orderBy(desc(schema.bookings.createdAt))
    .limit(20);

  const auditRows = await db
    .select()
    .from(schema.auditLog)
    .where(eq(schema.auditLog.clinicId, id))
    .orderBy(desc(schema.auditLog.createdAt))
    .limit(15);

  return { clinic, owners, recentBookings, auditRows };
}

export default async function WorkspaceDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isFinite(numericId)) notFound();

  const data = await loadDetail(numericId);
  if (!data) notFound();

  const { clinic, owners, recentBookings, auditRows } = data;
  const openingHours = clinic.openingHours as
    | Record<string, { open?: string; close?: string; open2?: string; close2?: string; closed?: boolean }>
    | null;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/workspaces" className="text-xs text-muted-foreground hover:text-primary">
          ← All workspaces
        </Link>
        <h1 className="pt-1 text-2xl font-bold tracking-tight">{clinic.name}</h1>
        <div className="pt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span>{clinic.tenantType}</span>
          {clinic.slug ? <span>· /{clinic.slug}</span> : null}
          <span>· created {fmtDate(clinic.createdAt)}</span>
          <span>· slot {clinic.slotLengthMin}m</span>
          {clinic.publicListing ? (
            <span className="text-emerald-600 dark:text-emerald-400">· listed</span>
          ) : (
            <span>· unlisted</span>
          )}
          {clinic.acceptAppBookings ? null : (
            <span className="text-amber-600 dark:text-amber-400">· app bookings paused</span>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader className="p-6 pb-3"><CardTitle>Owner(s)</CardTitle></CardHeader>
          <CardContent className="p-6 pt-0 space-y-3 text-sm">
            {owners.length === 0 ? (
              <div className="text-muted-foreground">No owner rows — orphaned workspace.</div>
            ) : (
              owners.map((u) => (
                <div key={u.id} className="space-y-0.5">
                  <div className="font-medium">{u.name} <span className="text-[11px] text-muted-foreground">· {u.role}</span></div>
                  <div className="text-muted-foreground">{u.mobile}</div>
                  {u.email ? <div className="text-muted-foreground text-xs">{u.email}</div> : null}
                  <div className="text-[11px] text-muted-foreground">
                    Last login: {u.lastLoginAt ? relTime(u.lastLoginAt) : "never"}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-6 pb-3"><CardTitle>Address</CardTitle></CardHeader>
          <CardContent className="p-6 pt-0 text-sm space-y-1 text-muted-foreground">
            <div>{clinic.address ?? "—"}</div>
            {clinic.city ? <div>{clinic.city}</div> : null}
            {clinic.phone ? <div>Phone: {clinic.phone}</div> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-6 pb-3"><CardTitle>Opening hours</CardTitle></CardHeader>
          <CardContent className="p-6 pt-0 text-sm space-y-1">
            {openingHours ? (
              (["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const).map((k) => {
                const h = openingHours[k];
                const closed = !h || h.closed || (!h.open && !h.close);
                return (
                  <div key={k} className="flex justify-between">
                    <span className="uppercase text-[11px] text-muted-foreground w-10">{k}</span>
                    <span className={closed ? "text-muted-foreground" : ""}>
                      {closed
                        ? "closed"
                        : `${h.open} – ${h.close}${h.open2 ? ` · ${h.open2} – ${h.close2}` : ""}`}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="text-muted-foreground">not set</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="p-6 pb-3"><CardTitle>Recent bookings</CardTitle></CardHeader>
          <CardContent className="p-0">
            {recentBookings.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">No bookings yet.</div>
            ) : (
              <ul className="divide-y divide-border">
                {recentBookings.map((r) => (
                  <li key={r.booking.id} className="p-4 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">T-{r.booking.token} · {r.patient?.name ?? "—"}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {r.booking.status} · {fmtDateTime(r.booking.slotTime)}
                      </div>
                    </div>
                    <div className="text-[11px] text-muted-foreground shrink-0">
                      {relTime(r.booking.createdAt)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-6 pb-3"><CardTitle>Audit log</CardTitle></CardHeader>
          <CardContent className="p-0">
            {auditRows.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">Nothing logged yet.</div>
            ) : (
              <ul className="divide-y divide-border">
                {auditRows.map((a) => (
                  <li key={a.id} className="p-4 text-xs">
                    <div className="flex justify-between gap-4">
                      <span className="font-mono text-muted-foreground">{a.eventType}</span>
                      <span className="text-muted-foreground shrink-0">
                        {relTime(a.createdAt)}
                      </span>
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
