import { requireDoctor } from "@/lib/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkspaceForm } from "./workspace-form";
import { TestBookingLinkButton } from "./test-booking-link";

export const dynamic = "force-dynamic";

export default async function WorkspaceSettingsPage() {
  const sess = await requireDoctor();
  return (
    <div className="space-y-6">
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
              phone: sess.clinic.phone ?? "",
              city: sess.clinic.city ?? "",
              slug: sess.clinic.slug ?? "",
              publicListing: sess.clinic.publicListing ?? false,
              timezone: sess.clinic.timezone,
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-6 pb-3">
          <CardTitle className="text-base">Self-serve booking link</CardTitle>
        </CardHeader>
        <CardContent className="p-6 pt-0">
          <TestBookingLinkButton />
        </CardContent>
      </Card>
    </div>
  );
}
