import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { Card, CardContent } from "@/components/ui/card";
import { SetupForm } from "./setup-form";

// Type-aware no-show thresholds. A clinic doctor running 15-min slots tolerates
// far less lateness than a spa with 60-min sessions; falling back to 30 for
// "other" feels safe.
const NO_SHOW_DEFAULTS_BY_TYPE: Record<string, number> = {
  clinic: 15,
  dental: 20,
  salon: 30,
  spa: 45,
  vet: 20,
  other: 30,
};

export default async function SetupPage() {
  const sess = await requireSession();
  if (sess.clinic.setupComplete) redirect("/queue");

  const openingHours =
    (sess.clinic.openingHours as Record<
      string,
      { open?: string; close?: string; closed?: boolean }
    >) ?? {};

  // The signup action seeds noShowThresholdMin = 45 for everyone. Override
  // with the type-aware default the first time the user lands on /setup.
  const typeDefault =
    NO_SHOW_DEFAULTS_BY_TYPE[sess.clinic.tenantType] ??
    NO_SHOW_DEFAULTS_BY_TYPE.other;
  const noShowInitial =
    sess.clinic.noShowThresholdMin === 45 ? typeDefault : sess.clinic.noShowThresholdMin;

  return (
    <div className="relative grid min-h-screen place-items-center px-4 py-10">
      <div className="orb -top-32 -left-32 size-[480px] bg-primary/25" />
      <div className="orb -bottom-32 -right-32 size-[380px] bg-primary/15" />
      <Card className="relative z-10 w-full max-w-2xl">
        <CardContent className="space-y-6 p-8">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-gradient">
              Finish setting up {sess.clinic.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              You can change any of this later in Settings.
            </p>
          </div>
          <SetupForm
            initial={{
              address: sess.clinic.address,
              slotLength: sess.clinic.slotLengthMin,
              noShowThreshold: noShowInitial,
              openingHours,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
