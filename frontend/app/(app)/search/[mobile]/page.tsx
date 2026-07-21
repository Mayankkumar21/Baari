import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Languages,
  Phone,
  UserPlus,
  UserX,
} from "lucide-react";
import { requireSetup } from "@/lib/session";
import { vocabFor } from "@/lib/vocab";
import { fmtDateTime } from "@/lib/time";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getCustomerProfile } from "@/lib/services/patients";

export const dynamic = "force-dynamic";

function StatusPill({ status }: { status: string }) {
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

function fmtMinutes(sec: number | null): string {
  if (sec == null) return "—";
  if (sec < 60) return `${sec}s`;
  return `${Math.round(sec / 60)}m`;
}

export default async function CustomerProfilePage({
  params,
}: {
  params: Promise<{ mobile: string }>;
}) {
  const sess = await requireSetup();
  const vocab = vocabFor(sess.clinic.tenantType);
  const { mobile } = await params;
  const profile = await getCustomerProfile(sess.clinic.id, mobile);
  if (!profile) notFound();

  const Stat = ({
    label,
    value,
    icon: Icon,
    tone,
  }: {
    label: string;
    value: string;
    icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    tone?: "warn" | "default";
  }) => (
    <div className="rounded-lg border border-border bg-card/60 p-3 backdrop-blur">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
        <Icon className="size-3" />
        {label}
      </div>
      <div
        className={`mt-1 text-xl font-bold tabular-nums ${
          tone === "warn" && profile.noShowCount > 0
            ? "text-amber-600 dark:text-amber-300"
            : ""
        }`}
      >
        {value}
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/search">
            <ArrowLeft className="size-4" /> Back to search
          </Link>
        </Button>
      </div>

      {/* Header card — name, mobile, status pills */}
      <Card>
        <CardContent className="p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-2xl font-bold tracking-tight">{profile.name}</h1>
                {profile.isNew && !profile.lastVisitAt ? (
                  <span
                    title="On file but hasn't visited yet."
                    className="inline-flex cursor-help items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary"
                  >
                    <UserPlus className="size-2.5" /> first visit
                  </span>
                ) : null}
                {profile.noShowCount >= 3 ? (
                  <span
                    title="Three or more no-shows on record — consider a confirmation call before the next slot."
                    className="inline-flex cursor-help items-center gap-1 rounded-full border border-amber-400/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-300"
                  >
                    <UserX className="size-2.5" /> frequent no-show
                  </span>
                ) : null}
              </div>
              <div className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                <Phone className="size-3.5" />
                {/* profile.mobile is already E.164 (normalizeMobile
                    stores "+91…" / "+1…" etc.), so just render it. The
                    old "+91 {mobile}" template showed either a doubled
                    prefix ("+91 +919893…") or wrong country ("+91 +1…")
                    for anyone booked with a non-India number. */}
                <span className="tabular-nums">{profile.mobile}</span>
              </div>
            </div>
            <Button asChild>
              <Link
                href={`/book?prefill_mobile=${encodeURIComponent(profile.mobile)}&prefill_name=${encodeURIComponent(profile.name)}`}
              >
                Book {vocab.sessionTitled.toLowerCase()}
              </Link>
            </Button>
          </div>

          {/* Stats grid */}
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat
              label="Total visits"
              value={String(profile.totalVisits)}
              icon={CalendarDays}
            />
            <Stat
              label="Completed"
              value={String(profile.completedVisits)}
              icon={CheckCircle2}
            />
            <Stat
              label="No-shows"
              value={String(profile.noShowCount)}
              icon={UserX}
              tone="warn"
            />
            <Stat
              label="Language"
              value={profile.languagePreference}
              icon={Languages}
            />
          </div>
        </CardContent>
      </Card>

      {/* Booking history */}
      <Card>
        <CardContent className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Booking history</h2>
            <span className="text-[11px] text-muted-foreground">
              {profile.bookings.length} {profile.bookings.length === 1 ? "row" : "rows"}
            </span>
          </div>

          {profile.bookings.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              On file but no bookings yet. Try Book {vocab.sessionTitled.toLowerCase()} above.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border/60 bg-card/40 backdrop-blur">
              <table className="w-full text-xs">
                <thead className="bg-secondary/40 text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5 text-left font-medium">When</th>
                    <th className="px-3 py-2.5 text-right font-medium">Token</th>
                    <th className="px-3 py-2.5 text-left font-medium">{vocab.reasonLabel}</th>
                    <th className="px-3 py-2.5 text-left font-medium">Status</th>
                    <th className="px-3 py-2.5 text-right font-medium">Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {profile.bookings.map((b) => (
                    <tr key={b.id} className="hover:bg-secondary/20">
                      <td className="px-3 py-2 text-muted-foreground">
                        {fmtDateTime(b.slotTime, sess.clinic.timezone)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">T{b.token}</td>
                      <td className="px-3 py-2 text-muted-foreground">{b.reason ?? "—"}</td>
                      <td className="px-3 py-2">
                        <StatusPill status={b.status} />
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {fmtMinutes(b.durationSec)}
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
