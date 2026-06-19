import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { Card, CardContent } from "@/components/ui/card";
import { SetupForm } from "./setup-form";

export default async function SetupPage() {
  const sess = await requireSession();
  if (sess.clinic.setupComplete) redirect("/queue");

  const openingHours = (sess.clinic.openingHours as Record<string, { open?: string; close?: string; closed?: boolean }>) ?? {};

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
              noShowThreshold: sess.clinic.noShowThresholdMin,
              openingHours,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
