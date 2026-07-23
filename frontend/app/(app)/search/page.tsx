import Link from "next/link";
import { Clock, History, Search, UserPlus, UserX } from "lucide-react";
import { and, eq, ilike, or } from "drizzle-orm";
import { requireSetup } from "@/lib/session";
import { db, schema } from "@/lib/db/client";
import { vocabFor } from "@/lib/vocab";
import { hasPlan } from "@/lib/plans";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { fmtDateTime } from "@/lib/time";
import { getRecentGuests } from "@/lib/services/patients";
import { AddGuestButton } from "./add-guest-button";
import { countryFromMobile } from "@/components/country-code-picker";

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

// "just now" / "10m ago" stays useful while the timestamp is *fresh* — but
// after an hour, an exact wallclock ("yesterday 14:30") tells the receptionist
// far more than "3h ago" or "12d ago". The old function leaned on relative
// strings even for visits months back, which masked the actual date.
function visitStamp(iso: string | null): string {
  if (!iso) return "no visits yet";
  const d = new Date(iso);
  const ms = Date.now() - d.getTime();
  const sec = Math.round(ms / 1000);
  if (sec < 60) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;

  // ≥ 1 hour: anchor to the actual day.
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);

  const today = new Date();
  const sameDay = (a: Date, b: Date) =>
    a.toDateString() === b.toDateString();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (sameDay(d, today)) return `today ${time}`;
  if (sameDay(d, yesterday)) return `yesterday ${time}`;

  // Within the past week: weekday + time.
  const daysAgo = Math.floor((Date.now() - d.getTime()) / (24 * 60 * 60 * 1000));
  if (daysAgo < 7) {
    const weekday = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      weekday: "short",
    }).format(d);
    return `${weekday} ${time}`;
  }

  // Within the current calendar year: day + short month.
  const sameYear = d.getFullYear() === today.getFullYear();
  const dayMonth = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  }).format(d);
  return `${dayMonth} ${time}`;
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
        <AddGuestButton defaultCountryCode={countryFromMobile(sess.user.mobile)?.code} />
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
                    <Link
                      href={`/search/${encodeURIComponent(r.patientMobile)}`}
                      className="flex items-center justify-between gap-3 rounded-md border border-border bg-card/60 p-3 backdrop-blur transition-all hover:border-primary/40 hover:translate-x-0.5"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-semibold">
                          T{r.token} · {r.patientName}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {r.patientMobile} · {fmtDateTime(r.slotTime, sess.clinic.timezone)}
                        </div>
                      </div>
                      <SearchStatusPill status={r.status} />
                    </Link>
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
          showLtv={hasPlan(sess.clinic, "pro")}
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
  showLtv,
}: {
  rows: Awaited<ReturnType<typeof getRecentGuests>>;
  entityPlural: string;
  entitySingular: string;
  showLtv: boolean;
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
              {/* Open the full customer profile — visit counts, no-shows,
                  language preference, and the complete booking history. */}
              <Link
                href={`/search/${encodeURIComponent(g.mobile)}`}
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
                    {showLtv && g.ltvInr > 0 ? (
                      <span
                        title={`Lifetime revenue from this ${entitySingular} across ${g.visitCount} visit${g.visitCount === 1 ? "" : "s"}.`}
                        className="inline-flex cursor-help items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-emerald-700 dark:text-emerald-300"
                      >
                        ₹{g.ltvInr.toLocaleString("en-IN")} LTV
                      </span>
                    ) : null}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    <span className="tabular-nums">{g.mobile}</span>
                    {" · "}
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-2.5" />
                      {visitStamp(g.lastVisitAt)}
                    </span>
                    {g.lastReason ? (
                      <>
                        {" · "}
                        <span>{g.lastReason}</span>
                      </>
                    ) : null}
                  </div>
                </div>
                <span className="text-[11px] text-muted-foreground">Open profile →</span>
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
