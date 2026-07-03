import { requireSetup } from "@/lib/session";
import { vocabFor } from "@/lib/vocab";
import { Card, CardContent } from "@/components/ui/card";
import { enumerateSlots, takenSlots } from "@/lib/services/booking";
import { servicesFor } from "@/lib/services/service-types";
import { clinicToday } from "@/lib/time";
import { BookForm } from "./book-form";

export const dynamic = "force-dynamic";

export default async function BookPage() {
  const sess = await requireSetup();
  const vocab = vocabFor(sess.clinic.tenantType);
  const today = clinicToday();
  const taken = await takenSlots(sess.clinic.id, today);
  const slots = enumerateSlots(sess.clinic, today, taken);
  const freeCount = slots.filter((s) => s.status === "open").length;
  const services = servicesFor(sess.clinic.tenantType);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New booking</h1>
        <p className="text-sm text-muted-foreground">
          {freeCount} of {slots.length} slots free today.
        </p>
      </div>

      <Card>
        <CardContent className="p-4 sm:p-6">
          <BookForm
            slots={slots}
            freeCount={freeCount}
            totalCount={slots.length}
            services={services}
            reasonLabel={vocab.reasonLabel}
            entitySingular={vocab.entitySingular}
          />
        </CardContent>
      </Card>
    </div>
  );
}
