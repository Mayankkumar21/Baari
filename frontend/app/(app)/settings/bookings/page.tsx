import { requireDoctor } from "@/lib/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { servicesFor } from "@/lib/services/service-types";
import { BookingsForm } from "./bookings-form";

export const dynamic = "force-dynamic";

export default async function BookingsSettingsPage() {
  const sess = await requireDoctor();
  const catalogue = servicesFor(sess.clinic.tenantType ?? "clinic");
  // null == "all services bookable" (friendliest default). An explicit
  // subset locks down the confirm sheet.
  const allowed = (sess.clinic.bookableServices as string[] | null) ?? catalogue;
  return (
    <Card>
      <CardHeader className="p-6 pb-3">
        <CardTitle>App bookings</CardTitle>
        <p className="pt-1 text-xs text-muted-foreground">
          Control what customers can do from the Baari mobile app. These
          settings don&apos;t affect the front-desk queue.
        </p>
      </CardHeader>
      <CardContent className="p-6 pt-0">
        <BookingsForm
          initial={{
            acceptAppBookings: sess.clinic.acceptAppBookings,
            catalogue,
            allowed,
          }}
        />
      </CardContent>
    </Card>
  );
}
