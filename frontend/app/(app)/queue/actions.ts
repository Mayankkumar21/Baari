"use server";

import { revalidatePath } from "next/cache";
import { requireDoctor, requireSetup } from "@/lib/session";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import {
  checkIn,
  displayTokenForBooking,
  markDone,
  markNoShowManual,
  reopenBooking,
  restoreNoShow,
  startConsult,
  undoDone,
} from "@/lib/services/queue";
import {
  rescheduleBooking,
  cancelBooking,
  createWalkIn,
  BookingError,
} from "@/lib/services/booking";
import { dispatchWhatsapp } from "@/lib/whatsapp";
import { closeDay, DayCloseError } from "@/lib/services/day-close";

type Result = { ok: true } | { ok: false; error: string };

async function run(
  fn: (clinicId: number, bookingId: number) => Promise<void>,
  bookingId: number,
): Promise<Result> {
  const sess = await requireSetup();
  try {
    await fn(sess.clinic.id, bookingId);
    revalidatePath("/queue");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function checkInAction(bookingId: number) {
  return run(checkIn, bookingId);
}
export async function startConsultAction(bookingId: number) {
  return run(startConsult, bookingId);
}
export async function markDoneAction(
  bookingId: number,
  amountPaidInr?: number | null,
  category?: string | null,
) {
  const sess = await requireSetup();
  try {
    await markDone(sess.clinic.id, bookingId, amountPaidInr ?? null, category ?? null);
    revalidatePath("/queue");
    revalidatePath("/reports");
    return { ok: true } as const;
  } catch (err) {
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
export async function restoreNoShowAction(bookingId: number) {
  return run(restoreNoShow, bookingId);
}
export async function undoDoneAction(bookingId: number) {
  return run(undoDone, bookingId);
}

export async function rescheduleAction(
  bookingId: number,
  newSlotIso: string,
): Promise<Result> {
  const sess = await requireSetup();
  try {
    const newSlotTime = new Date(newSlotIso);
    if (Number.isNaN(newSlotTime.getTime())) {
      return { ok: false, error: "Invalid slot time." };
    }
    await rescheduleBooking({
      clinicId: sess.clinic.id,
      bookingId,
      newSlotTime,
    });
    revalidatePath("/queue");
    return { ok: true };
  } catch (err) {
    if (err instanceof BookingError) return { ok: false, error: err.message };
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function cancelAction(bookingId: number): Promise<Result> {
  const sess = await requireSetup();
  try {
    await cancelBooking({ clinicId: sess.clinic.id, bookingId });
    revalidatePath("/queue");
    return { ok: true };
  } catch (err) {
    if (err instanceof BookingError) return { ok: false, error: err.message };
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function markNoShowAction(bookingId: number): Promise<Result> {
  const sess = await requireSetup();
  try {
    await markNoShowManual(sess.clinic.id, bookingId);
    revalidatePath("/queue");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function reopenAction(bookingId: number, reason: string): Promise<Result> {
  const sess = await requireSetup();
  try {
    await reopenBooking({
      clinicId: sess.clinic.id,
      bookingId,
      userId: sess.user.id,
      reason,
    });
    revalidatePath("/queue");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function sendReminderAction(bookingId: number): Promise<Result> {
  const sess = await requireSetup();
  try {
    const [booking] = await db
      .select()
      .from(schema.bookings)
      .where(eq(schema.bookings.id, bookingId))
      .limit(1);
    if (!booking || booking.clinicId !== sess.clinic.id) {
      return { ok: false, error: "Booking not found." };
    }
    const [patient] = await db
      .select()
      .from(schema.patients)
      .where(eq(schema.patients.id, booking.patientId))
      .limit(1);
    if (!patient) return { ok: false, error: "Patient not found." };
    // Use the slot-order display token — matches what the customer
    // sees on the live status page and hears called out at the desk.
    const displayToken =
      (await displayTokenForBooking(sess.clinic.id, booking.id)) ?? booking.token;
    await dispatchWhatsapp({
      clinicId: sess.clinic.id,
      patient,
      booking,
      trigger: "youre_next",
      payload: { token: displayToken, slot: booking.slotTime.toISOString() },
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function walkInAction(formData: FormData): Promise<Result> {
  const sess = await requireSetup();
  try {
    await createWalkIn({
      clinic: sess.clinic,
      createdByUserId: sess.user.id,
      name: String(formData.get("name") ?? ""),
      mobile: String(formData.get("mobile") ?? ""),
    });
    revalidatePath("/queue");
    return { ok: true };
  } catch (err) {
    if (err instanceof BookingError) return { ok: false, error: err.message };
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function closeDayAction(): Promise<Result> {
  const sess = await requireDoctor();
  try {
    await closeDay(sess.clinic.id, sess.clinic.timezone);
    revalidatePath("/queue");
    return { ok: true };
  } catch (err) {
    if (err instanceof DayCloseError) return { ok: false, error: err.message };
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
