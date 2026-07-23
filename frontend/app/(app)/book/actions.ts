"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSetup } from "@/lib/session";
import { createBooking, BookingError } from "@/lib/services/booking";
import { displayTokenForBooking } from "@/lib/services/queue";
import { dispatchWhatsapp } from "@/lib/whatsapp";
import { db, schema } from "@/lib/db/client";
import { eq } from "drizzle-orm";

export type BookState = {
  error?: string;
  // When the user clicked "Save & add another", the form stays open and the
  // client resets its fields after we return.
  addAnother?: boolean;
};

export async function bookAction(_prev: BookState, formData: FormData): Promise<BookState> {
  const sess = await requireSetup();
  const mode = String(formData.get("mode") ?? "create");
  const fromQueuePanel = String(formData.get("from_panel") ?? "") === "1";
  try {
    const slotIso = String(formData.get("slot_time") ?? "");
    if (!slotIso) return { error: "Pick a slot." };
    const booking = await createBooking({
      clinic: sess.clinic,
      createdByUserId: sess.user.id,
      name: String(formData.get("name") ?? ""),
      mobile: String(formData.get("mobile") ?? ""),
      slotTime: new Date(slotIso),
      reason: String(formData.get("reason") ?? "").trim() || null,
      isNew: formData.get("is_new") === "on",
      partySize: Number(formData.get("party_size") ?? "1") || 1,
      whatsappOptOut: formData.get("whatsapp_opt_out") === "on",
    });
    // Fire-and-forget confirmation.
    const [patient] = await db
      .select()
      .from(schema.patients)
      .where(eq(schema.patients.id, booking.patientId));
    if (patient) {
      // Slot-order display token — the WhatsApp confirmation should
      // show the same T{n} the customer will see on the live status
      // page and hear at the desk.
      const displayToken =
        (await displayTokenForBooking(sess.clinic.id, booking.id)) ?? booking.token;
      void dispatchWhatsapp({
        clinicId: sess.clinic.id,
        patient,
        booking,
        trigger: "booking_confirmed",
        payload: { token: displayToken, slot: booking.slotTime.toISOString() },
      });
    }
  } catch (err) {
    if (err instanceof BookingError) return { error: err.message };
    console.error(err);
    return { error: "Could not create booking." };
  }

  // "Save & add another": stay on the panel/page, signal the client to reset
  // the form. The /queue revalidation makes sure the row count updates if
  // the panel is open on top of the queue.
  if (mode === "add_another") {
    revalidatePath("/queue");
    if (fromQueuePanel) revalidatePath("/book");
    return { addAnother: true };
  }

  // Default: redirect back to /queue. Skipping when invoked from the panel —
  // there the parent will close the sheet after revalidation.
  if (fromQueuePanel) {
    revalidatePath("/queue");
    return {};
  }
  redirect("/queue");
}
