import { requireSetup } from "@/lib/session";
import { vocabFor } from "@/lib/vocab";
import { Card, CardContent } from "@/components/ui/card";
import { availableSlots, takenSlots } from "@/lib/services/booking";
import { clinicToday } from "@/lib/time";
import { BookForm } from "./book-form";

export const dynamic = "force-dynamic";

export default async function BookPage() {
  const sess = await requireSetup();
  const vocab = vocabFor(sess.clinic.tenantType);
  const today = clinicToday();
  const taken = await takenSlots(sess.clinic.id, today);
  const slots = availableSlots(sess.clinic, today, taken);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New booking</h1>
        <p className="text-sm text-muted-foreground">
          Today's slots — IST. {slots.length} open.
        </p>
      </div>

      <Card>
        <CardContent className="p-6">
          <BookForm
            slots={slots}
            reasonLabel={vocab.reasonLabel}
            entitySingular={vocab.entitySingular}
          />
        </CardContent>
      </Card>
    </div>
  );
}
