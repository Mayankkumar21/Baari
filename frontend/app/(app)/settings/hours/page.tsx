import { requireDoctor } from "@/lib/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HoursForm } from "./hours-form";

export const dynamic = "force-dynamic";

export default async function HoursSettingsPage() {
  const sess = await requireDoctor();
  const openingHours =
    (sess.clinic.openingHours as Record<
      string,
      { open?: string; close?: string; closed?: boolean; open2?: string; close2?: string }
    >) ?? {};
  return (
    <Card>
      <CardHeader className="p-6 pb-3">
        <CardTitle>Opening hours</CardTitle>
        <p className="pt-1 text-xs text-muted-foreground">
          Use breaks for businesses with split shifts (e.g. lunch close).
        </p>
      </CardHeader>
      <CardContent className="p-6 pt-0">
        <HoursForm initial={openingHours} />
      </CardContent>
    </Card>
  );
}
