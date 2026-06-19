import Link from "next/link";
import { Clock, History, Search, UserPlus, UserX } from "lucide-react";
import { and, eq, ilike, or } from "drizzle-orm";
import { requireSetup } from "@/lib/session";
import { db, schema } from "@/lib/db/client";
import { vocabFor } from "@/lib/vocab";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { fmtDateTime } from "@/lib/time";
import { getRecentGuests } from "@/lib/services/patients";
import { AddGuestButton } from "./add-guest-button";

export const dynamic = "force-dynamic";

async function search(clinicId: number, q: string) {
  if (!q || q.length < 2) return [];
  const like = `%${q}%`;
  return db
    .select({
      id: schema.bookings.id,
      token: schema.bookings.token,
      slotTime: schema.bookings.slotTime,
      reason: schema.bookings.reason,
      status: schema.bookings.status,
      patientName: schema.patients.name,
      patientMobile: schema.patients.mobile,
    })
    .from(schema.bookings)
    .innerJoin(schema.patients, eq(schema.bookings.patientId, schema.patients.id))
    .where(
      and(
        eq(schema.bookings.clinicId, clinicId),
        or(ilike(schema.patients.name, like), ilike(schema.patients.mobile, like)),
      ),
    )
    .orderBy(schema.bookings.slotTime)
    .limit(30);
}

function relativeTime(iso: string | null): string {
  if (!iso) return "no visits yet";
  const ms = Date.now() - new Date(iso).getTime();
  const sec = Math.round(ms / 1000);
  if (sec < 60) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.round(hr / 24);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.round(months / 12)}y ago`;
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sess = await requireSetup();
  const vocab = vocabFor(sess.clinic.tenantType);
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const results = q.length >= 2 ? await search(sess.clinic.id, q) : [];
  const recents = q.length >= 2 ? [] : await getRecentGuests(sess.clinic.id, 12);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Search</h1>
          <p className="text-sm text-muted-foreground">
            Find a {vocab.entitySingular} by name or mobile, or add a new one.
          </p>
        </div>
        <AddGuestButton />
      </div>

      <form className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          name="q"
          defaultValue={q}
          autoFocus
          placeholder="Name or 10-digit mobile…"
          className="h-12 pl-10 text-base"
        />
      </form>

      {q.length >= 2 ? (
        <Card>
          <CardContent className="p-4">
            {results.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No matches. Try a different name or number.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {results.map((r) => (
                  <li key={r.id}>
                    <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-card/60 p-3 backdrop-blur transition-all hover:border-primary/40 hover:translate-x-0.5">
                      <div className="min-w-0">
                        <div className="truncate font-semibold">
                          T{r.token} · {r.patientName}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {r.patientMobile} · {fmtDateTime(r.slotTime)}
                        </div>
                      </div>
                      <SearchStatusPill status={r.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : (
        <RecentGuests
          rows={recents}
          entityPlural={vocab.entityPlural}
          entitySingular={vocab.entitySingular}
        />
      )}
    </div>
  );
}

function SearchStatusPill({ status }: { status: string }) {
  // Same unified status colour system used on /queue and /reports.
  const tone =
    status === "in_consult"
      ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
      : status === "done"
        ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
        : status === "no_show"
          ? "border-rose-400/40 bg-rose-500/15 text-rose-700 dark:text-rose-300"
          : status === "cancelled"
            ? "border-border bg-secondary/60 text-muted-foreground line-through"
            : status === "checked_in"
              ? "border-primary/40 bg-primary/15 text-primary"
              : "border-primary/30 bg-primary/10 text-primary";
  return (
    <span
      className={`inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize ${tone}`}
    >
      {status.replace("_", " ")}
    </span>
  );
}

function RecentGuests({
  rows,
  entityPlural,
  entitySingular,
}: {
  rows: Awaited<ReturnType<typeof getRecentGuests>>;
  entityPlural: string;
  entitySingular: string;
}) {
  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <UserX className="mx-auto mb-2 size-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No {entityPlural} on file yet. Add one with the button above —
            this list fills in as bookings come through.
          </p>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardContent className="space-y-1.5 p-4">
        <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
          <History className="size-3.5" /> Recent {entityPlural}
        </div>
        <ul className="space-y-1.5">
          {rows.map((g) => (
            <li key={g.id}>
              {/* Clicking the row re-searches for the guest's mobile — that
                  returns every booking they've ever had at this clinic. */}
              <Link
                href={`/search?q=${encodeURIComponent(g.mobile)}`}
                className="flex items-center justify-between rounded-md border border-border bg-card/60 p-3 backdrop-blur transition-all hover:border-primary/40 hover:translate-x-0.5"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-semibold">{g.name}</span>
                    {g.isNew && !g.lastVisitAt ? (
                      <span
                        title="On file but hasn't visited yet."
                        className="inline-flex cursor-help items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
                      >
                        <UserPlus className="size-2.5" /> first visit
                      </span>
                    ) : null}
                    {g.noShowCount > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-300">
                        {g.noShowCount} no-show{g.noShowCount === 1 ? "" : "s"}
                      </span>
                    ) : null}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    <span className="tabular-nums">{g.mobile}</span>
                    {" · "}
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-2.5" />
                      {relativeTime(g.lastVisitAt)}
                    </span>
                    {g.lastReason ? (
                      <>
                        {" · "}
                        <span>{g.lastReason}</span>
                      </>
                    ) : null}
                  </div>
                </div>
                <span className="text-[11px] text-muted-foreground">View history →</span>
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
