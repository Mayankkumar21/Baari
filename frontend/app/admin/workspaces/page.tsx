// /admin/workspaces — searchable directory of every workspace.
// Server-side search via ?q= against name + slug + owner mobile.

import Link from "next/link";
import { and, desc, eq, ilike, inArray, notInArray, or, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { normalizeMobile } from "@/lib/auth";
import { effectivePlan } from "@/lib/plans";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { relTime } from "../_fmt";
import { PlanCell } from "./plan-cell";

export const dynamic = "force-dynamic";

async function loadAdminIds(): Promise<number[]> {
  const raw = process.env.ADMIN_MOBILES?.split(",")
    .map((s) => normalizeMobile(s))
    .filter((m): m is string => Boolean(m)) ?? [];
  if (raw.length === 0) return [];
  const rows = await db
    .select({ id: schema.users.clinicId })
    .from(schema.users)
    .where(inArray(schema.users.mobile, raw));
  return Array.from(new Set(rows.map((r) => r.id)));
}

async function loadWorkspaces(query: string, excludeIds: number[]) {
  const trimmed = query.trim();
  const filters = [] as ReturnType<typeof and>[];
  if (excludeIds.length > 0) {
    filters.push(notInArray(schema.clinics.id, excludeIds));
  }
  if (trimmed) {
    const like = `%${trimmed}%`;
    filters.push(
      or(
        ilike(schema.clinics.name, like),
        ilike(schema.clinics.slug, like),
      ),
    );
  }

  const rows = await db
    .select({
      clinic: schema.clinics,
      owner: schema.users,
      totalBookings: sql<number>`(SELECT COUNT(*)::int FROM ${schema.bookings} b WHERE b.clinic_id = ${schema.clinics.id})`,
      weekBookings: sql<number>`(SELECT COUNT(*)::int FROM ${schema.bookings} b WHERE b.clinic_id = ${schema.clinics.id} AND b.created_at >= now() - interval '7 days')`,
    })
    .from(schema.clinics)
    .leftJoin(schema.users, eq(schema.users.clinicId, schema.clinics.id))
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(desc(schema.clinics.createdAt))
    .limit(200);

  // Dedup by clinic id (if multiple owners exist on same clinic the
  // join fans out — first owner wins for display).
  const seen = new Set<number>();
  const deduped = [] as typeof rows;
  for (const r of rows) {
    if (seen.has(r.clinic.id)) continue;
    seen.add(r.clinic.id);
    deduped.push(r);
  }
  return deduped;
}

export default async function AdminWorkspacesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q ?? "";
  const [excludeIds, workspaces] = await Promise.all([
    loadAdminIds(),
    loadAdminIds().then((ids) => loadWorkspaces(q, ids)),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Workspaces</h1>
          <p className="text-sm text-muted-foreground pt-1">
            {workspaces.length} shown · admin workspaces hidden ({excludeIds.length})
          </p>
        </div>
      </div>

      <form className="max-w-md">
        <Input
          name="q"
          defaultValue={q}
          placeholder="Search by name or slug…"
          autoFocus
        />
      </form>

      <Card>
        <CardContent className="p-0">
          {workspaces.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">
              {q ? "No workspaces match that search." : "No workspaces yet."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-[11px] uppercase tracking-widest text-muted-foreground">
                  <tr>
                    <th className="text-left p-3">Workspace</th>
                    <th className="text-left p-3">Owner</th>
                    <th className="text-left p-3">Type</th>
                    <th className="text-left p-3">Plan</th>
                    <th className="text-right p-3">Bookings 7d</th>
                    <th className="text-right p-3">Total</th>
                    <th className="text-right p-3">Last login</th>
                    <th className="text-right p-3">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {workspaces.map((w) => {
                    const staleLogin =
                      w.owner?.lastLoginAt &&
                      Date.now() - w.owner.lastLoginAt.getTime() > 30 * 24 * 60 * 60 * 1000;
                    return (
                      <tr key={w.clinic.id} className="border-t border-border hover:bg-muted/30">
                        <td className="p-3">
                          <Link
                            href={`/admin/workspaces/${w.clinic.id}`}
                            className="font-medium hover:text-primary"
                          >
                            {w.clinic.name}
                          </Link>
                          {w.clinic.slug ? (
                            <div className="text-[11px] text-muted-foreground">/{w.clinic.slug}</div>
                          ) : null}
                        </td>
                        <td className="p-3">
                          <div>{w.owner?.name ?? "—"}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {w.owner?.mobile ?? "—"}
                          </div>
                        </td>
                        <td className="p-3 text-muted-foreground">{w.clinic.tenantType}</td>
                        <td className="p-3">
                          <PlanCell
                            clinicId={w.clinic.id}
                            currentPlan={w.clinic.plan}
                            effectivePlan={effectivePlan(w.clinic)}
                            trialEndsAt={
                              w.clinic.planTrialEndsAt
                                ? w.clinic.planTrialEndsAt.toISOString()
                                : null
                            }
                            planSource={w.clinic.planSource}
                          />
                        </td>
                        <td className="p-3 text-right tabular-nums">{w.weekBookings ?? 0}</td>
                        <td className="p-3 text-right tabular-nums">{w.totalBookings ?? 0}</td>
                        <td className={`p-3 text-right text-xs ${staleLogin ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
                          {w.owner?.lastLoginAt
                            ? relTime(w.owner.lastLoginAt)
                            : "never"}
                        </td>
                        <td className="p-3 text-right text-xs text-muted-foreground">
                          {relTime(w.clinic.createdAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
