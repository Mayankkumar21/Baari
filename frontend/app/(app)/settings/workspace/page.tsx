import { requireDoctor } from "@/lib/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkspaceForm } from "./workspace-form";

export const dynamic = "force-dynamic";

export default async function WorkspaceSettingsPage() {
  const sess = await requireDoctor();
  return (
    <Card>
      <CardHeader className="p-6 pb-3">
        <CardTitle>Workspace</CardTitle>
      </CardHeader>
      <CardContent className="p-6 pt-0">
        <WorkspaceForm
          initial={{
            name: sess.clinic.name,
            tenantType: sess.clinic.tenantType,
            slot: sess.clinic.slotLengthMin,
            noShow: sess.clinic.noShowThresholdMin,
            address: sess.clinic.address ?? "",
          }}
        />
      </CardContent>
    </Card>
  );
}
