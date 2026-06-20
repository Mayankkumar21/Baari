import { redirect } from "next/navigation";
import Link from "next/link";
import { Calendar, CheckCircle2, MapPin, Phone } from "lucide-react";
import { db, schema } from "@/lib/db/client";
import { eq } from "drizzle-orm";
import {
  getBookingRequestByToken,
  requestStatus,
} from "@/lib/services/booking-request";
import { readLang, t } from "@/lib/i18n-mini";
import { fmtTime } from "@/lib/time";
import { vocabFor } from "@/lib/vocab";
import { ExpiredScreen } from "../screens";

export default async function DonePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { token } = await params;
  const sp = await searchParams;
  const lang = readLang(sp);

  const found = await getBookingRequestByToken(token);
  if (!found) return <ExpiredScreen lang={lang} />;
  const { request, clinic } = found;
  const status = requestStatus(request);
  if (status.kind === "cancelled") {
    redirect(`/b/${token}/cancel?done=1${lang === "hi" ? "&lang=hi" : ""}`);
  }
  if (status.kind !== "confirmed") {
    redirect(`/b/${token}${lang === "hi" ? "?lang=hi" : ""}`);
  }

  const [booking] = await db
    .select()
    .from(schema.bookings)
    .where(eq(schema.bookings.id, status.bookingId))
    .limit(1);
  if (!booking) return <ExpiredScreen lang={lang} clinic={clinic} />;

  const vocab = vocabFor(clinic.tenantType);
  const slotLabel = formatSlotLabel(new Date(booking.slotTime), lang);
  const mapsUrl = clinic.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${clinic.name} ${clinic.address}`)}`
    : null;
  const mobile = mask(request.mobile);

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center space-y-3 pt-2 text-center">
        <div className="grid size-14 place-items-center rounded-full border border-emerald-400/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
          <CheckCircle2 className="size-7" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">{t("youre_booked", lang)}</h1>
      </div>

      <div className="rounded-2xl border border-primary/30 bg-card/70 p-5 shadow-lg shadow-primary/10 backdrop-blur">
        <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          {lang === "hi" ? "टोकन" : "Token"}
        </div>
        <div className="text-4xl font-extrabold leading-none text-primary">
          T-{booking.token}
        </div>
        <div className="mt-2 text-sm font-semibold">{slotLabel}</div>
        <div className="mt-3 border-t border-border pt-3 text-sm">
          <div className="font-semibold">{clinic.name}</div>
          {clinic.address ? (
            <div className="text-xs text-muted-foreground">{clinic.address}</div>
          ) : null}
          <div className="mt-1 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            {vocab.sessionTitled.toLowerCase()}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <a
          href={`/b/${token}/calendar.ics`}
          download
          className="flex flex-col items-center gap-1 rounded-xl border border-border bg-card/60 py-3 text-[11px] font-medium backdrop-blur hover:border-primary/40"
        >
          <Calendar className="size-5 text-primary" />
          {t("add_to_calendar", lang)}
        </a>
        {mapsUrl ? (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-1 rounded-xl border border-border bg-card/60 py-3 text-[11px] font-medium backdrop-blur hover:border-primary/40"
          >
            <MapPin className="size-5 text-primary" />
            {t("get_directions", lang)}
          </a>
        ) : (
          <span className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-border bg-card/40 py-3 text-[11px] font-medium text-muted-foreground/60">
            <MapPin className="size-5" />
            {t("get_directions", lang)}
          </span>
        )}
        <span className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-border bg-card/40 py-3 text-[11px] font-medium text-muted-foreground/60">
          <Phone className="size-5" />
          {t("call_business", lang)}
        </span>
      </div>

      <Link
        href={`/b/${token}/status${lang === "hi" ? "?lang=hi" : ""}`}
        className="inline-flex w-full items-center justify-center rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/30 transition-all active:scale-[0.98]"
      >
        {t("see_live_status", lang)} →
      </Link>

      <div className="text-center text-sm text-muted-foreground">
        {t("need_to_cancel", lang)}{" "}
        <Link
          href={`/b/${token}/cancel${lang === "hi" ? "?lang=hi" : ""}`}
          className="font-semibold text-rose-500 hover:underline"
        >
          {t("cancel_booking", lang)}
        </Link>
      </div>

      <p className="text-center text-[11px] text-muted-foreground">
        {t("sent_to", lang)} {mobile}.
      </p>
    </div>
  );
}

function mask(mobile: string): string {
  // 9876543210 → +91 98••••3210 — show first 2 and last 4 only.
  if (mobile.length < 6) return `+91 ${mobile}`;
  const first = mobile.slice(0, 2);
  const last = mobile.slice(-4);
  return `+91 ${first}••••${last}`;
}

function formatSlotLabel(d: Date, lang: "en" | "hi") {
  const today = new Date();
  const tz = "Asia/Kolkata";
  const sameDay = (a: Date, b: Date) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(a) ===
    new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(b);
  const dayLabel = sameDay(d, today)
    ? lang === "hi" ? "आज" : "Today"
    : lang === "hi" ? "कल" : "Tomorrow";
  return `${dayLabel}, ${fmtTime(d)}`;
}
