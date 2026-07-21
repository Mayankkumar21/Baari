import { redirect } from "next/navigation";
import {
  getBookingRequestByToken,
  requestStatus,
} from "@/lib/services/booking-request";
import { readLang, t } from "@/lib/i18n-mini";
import { vocabFor } from "@/lib/vocab";
import { servicesFor } from "@/lib/services/service-types";
import { fmtTime } from "@/lib/time";
import { DetailsForm } from "./details-form";
import { ExpiredScreen } from "../screens";

export default async function DetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ slot?: string; lang?: string }>;
}) {
  const { token } = await params;
  const sp = await searchParams;
  const lang = readLang(sp);

  const found = await getBookingRequestByToken(token);
  if (!found) return <ExpiredScreen lang={lang} />;
  const { request, clinic } = found;
  const status = requestStatus(request);
  if (status.kind === "confirmed") {
    redirect(`/b/${token}/done${lang === "hi" ? "?lang=hi" : ""}`);
  }
  if (status.kind === "cancelled") {
    redirect(`/b/${token}/cancel?done=1${lang === "hi" ? "&lang=hi" : ""}`);
  }
  if (status.kind === "expired") return <ExpiredScreen lang={lang} clinic={clinic} />;

  if (!sp.slot) {
    redirect(`/b/${token}${lang === "hi" ? "?lang=hi" : ""}`);
  }

  const vocab = vocabFor(clinic.tenantType);
  const services = servicesFor(clinic.tenantType);
  const slotTime = new Date(sp.slot!);
  const slotLabel = formatSlotLabel(slotTime, lang, clinic.timezone);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-xl font-bold tracking-tight">{t("almost_done", lang)}</h1>
        <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          {slotLabel}
        </div>
      </header>

      <DetailsForm
        token={token}
        lang={lang}
        slotIso={sp.slot!}
        services={services}
        reasonLabel={t("whats_it_for", lang)}
        nameLabel={t("your_name", lang)}
        firstVisitLabel={t("first_visit", lang)}
        confirmLabel={t("confirm_booking", lang)}
        otherLabel={t("other", lang)}
        smsNote={t("sms_confirm_note", lang)}
        entitySingular={vocab.entitySingular}
      />
    </div>
  );
}

function formatSlotLabel(d: Date, lang: "en" | "hi", tz: string) {
  const today = new Date();
  const sameDay = (a: Date, b: Date) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(a) ===
    new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(b);
  const dayLabel = sameDay(d, today)
    ? lang === "hi" ? "आज" : "Today"
    : lang === "hi" ? "कल" : "Tomorrow";
  return `${dayLabel}, ${fmtTime(d, tz)}`;
}
