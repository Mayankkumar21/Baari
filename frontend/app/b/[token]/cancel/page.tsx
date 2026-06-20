import Link from "next/link";
import { CheckCircle2, Phone } from "lucide-react";
import { db, schema } from "@/lib/db/client";
import { eq } from "drizzle-orm";
import {
  getBookingRequestByToken,
  requestStatus,
} from "@/lib/services/booking-request";
import { readLang, t } from "@/lib/i18n-mini";
import { fmtTime } from "@/lib/time";
import { ExpiredScreen } from "../screens";
import { CancelForm } from "./cancel-form";

export default async function CancelPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ lang?: string; done?: string }>;
}) {
  const { token } = await params;
  const sp = await searchParams;
  const lang = readLang(sp);
  const done = sp.done === "1";

  const found = await getBookingRequestByToken(token);
  if (!found) return <ExpiredScreen lang={lang} />;
  const { request, clinic } = found;
  const status = requestStatus(request);

  // After-cancel terminal state
  if (done || status.kind === "cancelled") {
    return <CancelledState lang={lang} clinicName={clinic.name} />;
  }

  if (status.kind !== "confirmed") {
    return <ExpiredScreen lang={lang} clinic={clinic} />;
  }

  const [booking] = await db
    .select()
    .from(schema.bookings)
    .where(eq(schema.bookings.id, status.bookingId))
    .limit(1);
  if (!booking) return <ExpiredScreen lang={lang} clinic={clinic} />;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold tracking-tight">{t("cancel_q", lang)}</h1>

      <div className="rounded-2xl border border-border bg-card/60 p-4 backdrop-blur">
        <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          {lang === "hi" ? "टोकन" : "Token"}
        </div>
        <div className="text-3xl font-extrabold leading-none text-primary">T-{booking.token}</div>
        <div className="mt-1 text-sm font-semibold">{fmtTime(booking.slotTime)}</div>
        <div className="mt-2 text-xs text-muted-foreground">{clinic.name}</div>
      </div>

      <CancelForm
        token={token}
        lang={lang}
        reasonLabel={t("reason_optional", lang)}
        keepLabel={t("keep_booking", lang)}
        cancelLabel={t("cancel_booking", lang)}
      />
    </div>
  );
}

function CancelledState({ lang, clinicName }: { lang: "en" | "hi"; clinicName: string }) {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center space-y-4 text-center">
      <div className="grid size-12 place-items-center rounded-full border border-emerald-400/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
        <CheckCircle2 className="size-6" />
      </div>
      <h1 className="text-lg font-bold tracking-tight">{t("cancelled_done", lang)}</h1>
      <p className="max-w-xs text-sm text-muted-foreground">
        {t("cancelled_rebook", lang)}{" "}
        <span className="font-semibold text-foreground">{clinicName}</span>{" "}
        {t("cancelled_rebook2", lang)}
      </p>
      <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-dashed border-border bg-card/40 px-3 py-1.5 text-[11px] text-muted-foreground/70">
        <Phone className="size-3.5" /> {t("call_now", lang)}
      </span>
    </div>
  );
}
