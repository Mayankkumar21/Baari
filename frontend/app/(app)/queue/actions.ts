"use server";

import { revalidatePath } from "next/cache";
import { requireSetup } from "@/lib/session";
import {
  checkIn,
  markDone,
  restoreNoShow,
  startConsult,
  undoDone,
} from "@/lib/services/queue";

async function run(fn: (clinicId: number, bookingId: number) => Promise<void>, bookingId: number) {
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
