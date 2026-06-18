"use server";

import { redirect } from "next/navigation";
import { requireSetup } from "@/lib/session";
import { createBooking, BookingError } from "@/lib/services/booking";
import { dispatchWhatsapp } from "@/lib/whatsapp";
import { db, schema } from "@/lib/db/client";
import { eq } from "drizzle-orm";

export type BookState = { error?: string };

export async function bookAction(_prev: BookState, formData: FormData): Promise<BookState> {
  const sess = await requireSetup();
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
      void dispatchWhatsapp({
        clinicId: sess.clinic.id,
        patient,
        booking,
        trigger: "booking_confirmed",
        payload: { token: booking.token, slot: booking.slotTime.toISOString() },
      });
    }
  } catch (err) {
    if (err instanceof BookingError) return { error: err.message };
    console.error(err);
    return { error: "Could not create booking." };
  }
  redirect("/queue");
}
