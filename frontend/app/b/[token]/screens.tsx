// Shared "states" rendered by C1: link expired, fully closed, etc.
// Kept here so each page file stays focused on its happy path.
import { Phone, Calendar, AlertCircle } from "lucide-react";
import { t, type Lang } from "@/lib/i18n-mini";
import { vocabFor } from "@/lib/vocab";
import type { Clinic } from "@/lib/db/schema";

export function ExpiredScreen({ lang, clinic }: { lang: Lang; clinic?: Clinic }) {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center space-y-4 text-center">
      <div className="grid size-12 place-items-center rounded-full border border-amber-400/40 bg-amber-500/10 text-amber-600 dark:text-amber-300">
        <AlertCircle className="size-6" />
      </div>
      <h1 className="text-lg font-bold tracking-tight">{t("link_expired_title", lang)}</h1>
      <p className="max-w-xs text-sm text-muted-foreground">
        {t("link_expired_body", lang)} <span className="font-semibold">{clinic?.name ?? "the business"}</span>{" "}
        {t("link_expired_call", lang)}
      </p>
      {/* The clinic mobile isn't on the schema today; fall back to a generic tap-to-call
          on the receptionist user once we wire it. For now omit unless we have it. */}
    </div>
  );
}

export function ClosedScreen({ lang, clinic }: { lang: Lang; clinic: Clinic }) {
  const vocab = vocabFor(clinic.tenantType);
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center space-y-4 text-center">
      <div className="grid size-12 place-items-center rounded-full border border-muted-foreground/30 bg-secondary/40">
        <Calendar className="size-6 text-muted-foreground" />
      </div>
      <h1 className="text-lg font-bold tracking-tight">{clinic.name}</h1>
      <p className="max-w-xs text-sm text-muted-foreground">
        {t("no_slots", lang)}
      </p>
      <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        {vocab.sessionTitled.toLowerCase()}
      </p>
    </div>
  );
}
