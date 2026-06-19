import { requireDoctor } from "@/lib/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const sess = await requireDoctor();
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Workspace basics. Opening hours editor lives in setup (see STATUS.md).
        </p>
      </div>
      <Card>
        <CardHeader className="p-6 pb-3">
          <CardTitle>Workspace</CardTitle>
        </CardHeader>
        <CardContent className="p-6 pt-0">
          <SettingsForm
            initial={{
              name: sess.clinic.name,
              tenantType: sess.clinic.tenantType,
              slot: sess.clinic.slotLengthMin,
              noShow: sess.clinic.noShowThresholdMin,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
