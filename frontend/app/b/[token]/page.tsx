import { redirect } from "next/navigation";
import Link from "next/link";
import { Phone } from "lucide-react";
import {
  getBookingRequestByToken,
  requestStatus,
  activeBookingForMobile,
  isClosedDay,
} from "@/lib/services/booking-request";
import { enumerateSlots, takenSlots } from "@/lib/services/booking";
import { clinicToday } from "@/lib/time";
import { t, readLang } from "@/lib/i18n-mini";
import { vocabFor } from "@/lib/vocab";
import { VerticalIcon } from "@/components/public/vertical-icon";
import { SlotPicker } from "./slot-picker";
import { ExpiredScreen, ClosedScreen } from "./screens";

export default async function BookingLandingPage({
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

  // Already used → push them to the live status (C4) — handles the
  // "Already booked: skip to C4" rule.
  if (status.kind === "confirmed") {
    redirect(`/b/${token}/status${lang === "hi" ? "?lang=hi" : ""}`);
  }
  if (status.kind === "cancelled") {
    redirect(`/b/${token}/cancel?done=1${lang === "hi" ? "&lang=hi" : ""}`);
  }
  if (status.kind === "expired") return <ExpiredScreen lang={lang} clinic={clinic} />;

  // Also: if this mobile already has an active booking elsewhere at the
  // same clinic, jump straight to the live status (they typed it once,
  // they don't want to type it again).
  const existing = await activeBookingForMobile(clinic.id, request.mobile);
  if (existing) {
    redirect(`/b/${token}/status${lang === "hi" ? "?lang=hi" : ""}`);
  }

  // Build the two-day slot picker. Today first; tomorrow only surfaced if
  // (a) today has open slots, OR (b) today doesn't but tomorrow does.
  const todayStr = clinicToday();
  const tomorrowStr = addDays(todayStr, 1);

  const todaySlots = (await isClosedDay(clinic.id, todayStr))
    ? []
    : (await enumerateSlotsFor(clinic, todayStr)).filter((s) => s.status === "open");
  const tomorrowSlots = (await isClosedDay(clinic.id, tomorrowStr))
    ? []
    : (await enumerateSlotsFor(clinic, tomorrowStr)).filter((s) => s.status === "open");

  const todayHasOpen = todaySlots.length > 0;
  const tomorrowHasOpen = tomorrowSlots.length > 0;

  if (!todayHasOpen && !tomorrowHasOpen) {
    return <ClosedScreen lang={lang} clinic={clinic} />;
  }

  const vocab = vocabFor(clinic.tenantType);

  return (
    <div className="space-y-6">
      {/* Header — business identity */}
      <header className="space-y-2 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary">
          <VerticalIcon tenantType={clinic.tenantType ?? "clinic"} className="size-6" />
        </div>
        <h1 className="text-xl font-bold tracking-tight">{clinic.name}</h1>
        {clinic.address ? (
          <p className="text-xs text-muted-foreground">
            {clinic.address}
            {" · "}
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                `${clinic.name} ${clinic.address}`,
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              {t("open_maps", lang)}
            </a>
          </p>
        ) : null}
        <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          {vocab.sessionTitled.toLowerCase()}
        </p>
      </header>

      <SlotPicker
        token={token}
        lang={lang}
        todaySlots={todaySlots.map((s) => s.iso)}
        tomorrowSlots={tomorrowSlots.map((s) => s.iso)}
        todayLabel={t("today", lang)}
        tomorrowLabel={t("tomorrow", lang)}
        pickTimeLabel={t("pick_time", lang)}
        continueLabel={t("continue", lang)}
        fullyBookedLabel={t("fully_booked", lang)}
        seeTomorrowLabel={t("see_tomorrow", lang)}
      />
    </div>
  );
}

async function enumerateSlotsFor(
  clinic: typeof import("@/lib/db/schema").clinics.$inferSelect,
  date: string,
) {
  const taken = await takenSlots(clinic.id, date);
  return enumerateSlots(clinic, date, taken);
}

function addDays(yyyyMmDd: string, n: number): string {
  // Treat the YYYY-MM-DD as IST noon to dodge DST/timezone slips, then
  // shift n days, then re-format. Returns YYYY-MM-DD.
  const d = new Date(`${yyyyMmDd}T12:00:00+05:30`);
  d.setUTCDate(d.getUTCDate() + n);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}
