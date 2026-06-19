"use server";

import { revalidatePath } from "next/cache";
import { requireDoctor, requireSetup } from "@/lib/session";
import {
  checkIn,
  markDone,
  promoteAfterSubDone,
  restoreNoShow,
  startConsult,
  undoDone,
} from "@/lib/services/queue";
import {
  rescheduleBooking,
  cancelBooking,
  BookingError,
} from "@/lib/services/booking";
import {
  addSubToken,
  cancelSubToken,
  markSubTokenDone,
  startSubToken,
  SubTokenError,
} from "@/lib/services/sub-token";
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
export async function markDoneAction(bookingId: number) {
  return run(markDone, bookingId);
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

export async function addSubTokenAction(
  bookingId: number,
  formData: FormData,
): Promise<Result> {
  const sess = await requireSetup();
  try {
    const name = String(formData.get("name") ?? "").trim();
    const reason = String(formData.get("reason") ?? "").trim() || null;
    await addSubToken({
      clinicId: sess.clinic.id,
      bookingId,
      name,
      reason,
    });
    revalidatePath("/queue");
    return { ok: true };
  } catch (err) {
    if (err instanceof SubTokenError) return { ok: false, error: err.message };
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function startSubTokenAction(subTokenId: number): Promise<Result> {
  const sess = await requireSetup();
  try {
    await startSubToken({ clinicId: sess.clinic.id, subTokenId });
    revalidatePath("/queue");
    return { ok: true };
  } catch (err) {
    if (err instanceof SubTokenError) return { ok: false, error: err.message };
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function markSubDoneAction(subTokenId: number): Promise<Result> {
  const sess = await requireSetup();
  try {
    const { bookingId } = await markSubTokenDone({
      clinicId: sess.clinic.id,
      subTokenId,
    });
    await promoteAfterSubDone(sess.clinic.id, bookingId);
    revalidatePath("/queue");
    return { ok: true };
  } catch (err) {
    if (err instanceof SubTokenError) return { ok: false, error: err.message };
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function cancelSubTokenAction(subTokenId: number): Promise<Result> {
  const sess = await requireSetup();
  try {
    await cancelSubToken({ clinicId: sess.clinic.id, subTokenId });
    revalidatePath("/queue");
    return { ok: true };
  } catch (err) {
    if (err instanceof SubTokenError) return { ok: false, error: err.message };
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function closeDayAction(): Promise<Result> {
  const sess = await requireDoctor();
  try {
    await closeDay(sess.clinic.id);
    revalidatePath("/queue");
    return { ok: true };
  } catch (err) {
    if (err instanceof DayCloseError) return { ok: false, error: err.message };
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
