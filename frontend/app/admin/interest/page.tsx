// /admin/interest — every "I want this plan" capture from the pricing
// page. Newest first. Filter by desired plan. Mark contacted /
// converted; one-click links to WhatsApp + email.

import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { db, schema } from "@/lib/db/client";
import { Card, CardContent } from "@/components/ui/card";
import { relTime } from "../_fmt";
import { InterestRowActions } from "./row-actions";

export const dynamic = "force-dynamic";

async function loadInterest(filter: "all" | "growth" | "pro") {
  const rows = await db
    .select({
      interest: schema.planInterest,
      clinic: {
        id: schema.clinics.id,
        name: schema.clinics.name,
        tenantType: schema.clinics.tenantType,
        plan: schema.clinics.plan,
        planTrialEndsAt: schema.clinics.planTrialEndsAt,
      },
      user: {
        id: schema.users.id,
        name: schema.users.name,
        mobile: schema.users.mobile,
        email: schema.users.email,
      },
    })
    .from(schema.planInterest)
    .leftJoin(schema.clinics, eq(schema.clinics.id, schema.planInterest.clinicId))
    .leftJoin(schema.users, eq(schema.users.id, schema.planInterest.userId))
    .where(
      filter === "all"
        ? undefined
        : eq(schema.planInterest.desiredPlan, filter),
    )
    .orderBy(desc(schema.planInterest.createdAt))
    .limit(300);
  return rows;
}

export default async function AdminInterestPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const sp = await searchParams;
  const filter =
    sp.filter === "growth" || sp.filter === "pro" ? sp.filter : "all";
  const rows = await loadInterest(filter);

  const totalCount = rows.length;
  const openCount = rows.filter((r) => !r.interest.contactedAt).length;
  const convertedCount = rows.filter((r) => r.interest.convertedAt).length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Interest queue</h1>
        <p className="pt-1 text-sm text-muted-foreground">
          Every &quot;I want this plan&quot; capture from /pricing. Contact them, close deals
          manually while payments aren&apos;t wired.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <FilterLink current={filter} value="all" label={`All (${totalCount})`} />
        <FilterLink current={filter} value="growth" label="Growth" />
        <FilterLink current={filter} value="pro" label="Pro" />
        <div className="ml-auto flex items-center gap-2 text-muted-foreground">
          <span>
            Open: <span className="font-semibold text-foreground">{openCount}</span>
          </span>
          <span>·</span>
          <span>
            Converted:{" "}
            <span className="font-semibold text-foreground">{convertedCount}</span>
          </span>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">
              No interest captures yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-[11px] uppercase tracking-widest text-muted-foreground">
                  <tr>
                    <th className="p-3 text-left">Workspace</th>
                    <th className="p-3 text-left">Owner</th>
                    <th className="p-3 text-left">Wants</th>
                    <th className="p-3 text-left">Region</th>
                    <th className="p-3 text-left">Note</th>
                    <th className="p-3 text-left">When</th>
                    <th className="p-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.interest.id}
                      className="border-t border-border hover:bg-muted/30"
                    >
                      <td className="p-3">
                        <Link
                          href={`/admin/workspaces/${r.clinic?.id}`}
                          className="font-medium hover:text-primary"
                        >
                          {r.clinic?.name ?? "—"}
                        </Link>
                        <div className="text-[11px] text-muted-foreground">
                          {r.clinic?.tenantType} · plan={r.clinic?.plan}
                        </div>
                      </td>
                      <td className="p-3">
                        <div>{r.user?.name ?? "—"}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {r.interest.contactMobile ?? r.user?.mobile ?? "—"}
                          {r.interest.contactEmail || r.user?.email ? (
                            <>
                              <br />
                              {r.interest.contactEmail ?? r.user?.email}
                            </>
                          ) : null}
                        </div>
                      </td>
                      <td className="p-3">
                        <PlanPill plan={r.interest.desiredPlan} />
                      </td>
                      <td className="p-3 text-[11px] text-muted-foreground">
                        {r.interest.region ?? "—"}
                      </td>
                      <td className="p-3 text-xs text-muted-foreground max-w-xs">
                        {r.interest.note ?? "—"}
                      </td>
                      <td className="p-3 text-[11px] text-muted-foreground">
                        {relTime(r.interest.createdAt)}
                      </td>
                      <td className="p-3 text-right">
                        <InterestRowActions
                          interestId={r.interest.id}
                          contactedAt={
                            r.interest.contactedAt
                              ? r.interest.contactedAt.toISOString()
                              : null
                          }
                          convertedAt={
                            r.interest.convertedAt
                              ? r.interest.convertedAt.toISOString()
                              : null
                          }
                          mobile={
                            r.interest.contactMobile ?? r.user?.mobile ?? null
                          }
                          email={
                            r.interest.contactEmail ?? r.user?.email ?? null
                          }
                          desiredPlan={r.interest.desiredPlan}
                          workspaceName={r.clinic?.name ?? ""}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function FilterLink({
  current,
  value,
  label,
}: {
  current: string;
  value: string;
  label: string;
}) {
  const active = current === value;
  return (
    <Link
      href={`/admin/interest${value === "all" ? "" : `?filter=${value}`}`}
      className={
        "rounded-full border px-3 py-1 text-xs font-medium capitalize " +
        (active
          ? "border-primary bg-primary/15 text-primary"
          : "border-border bg-card/60 text-muted-foreground hover:border-primary/40")
      }
    >
      {label}
    </Link>
  );
}

function PlanPill({ plan }: { plan: string }) {
  const tone =
    plan === "pro"
      ? "border-primary/40 bg-primary/10 text-primary"
      : "border-emerald-400/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${tone}`}
    >
      {plan}
    </span>
  );
}
