"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { nowUtc, clinicToday } from "@/lib/time";
import { takenSlots, nextToken } from "@/lib/services/booking";
import {
  getBookingRequestByToken,
  requestStatus,
  activeBookingCountForMobile,
  ACTIVE_BOOKING_CAP,
  cancelBookingFromRequest,
} from "@/lib/services/booking-request";
import { checkAndIncrement, LIMITS } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/client-ip";
import { assertMonthlyQuota, QuotaExceededError } from "@/lib/plans";

export type ConfirmState = { error?: string; ok?: boolean };

export async function confirmBookingAction(
  _prev: ConfirmState,
  formData: FormData,
): Promise<ConfirmState> {
  const token = String(formData.get("token") ?? "");
  const slotIso = String(formData.get("slot_time") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim() || null;
  const isNew = formData.get("is_new") === "on";
  const lang = formData.get("lang") === "hi" ? "hi" : "en";

  // Per-IP fuse. This endpoint is public — only the URL token gates
  // it — so IP is the only signal we have to stop a bot from
  // grinding the T-token retry loop or spamming the DB.
  const hdrs = await headers();
  const ip = getClientIp(hdrs);
  const rl = await checkAndIncrement(LIMITS.b_confirm_per_ip, "b_confirm", ip);
  if (!rl.ok) {
    return { error: "Too many attempts. Please wait a bit and try again." };
  }

  if (name.length < 2) return { error: "Enter your name." };
  if (!slotIso) return { error: "Pick a time." };

  const found = await getBookingRequestByToken(token);
  if (!found) return { error: "Link expired." };
  const { request, clinic } = found;

  const status = requestStatus(request);
  if (status.kind !== "ready") {
    return { error: "This link can't be used any more." };
  }

  // Cap: max 2 active bookings per mobile per clinic. Re-check inside the
  // transaction below as well — this short-circuits cheaply.
  const active = await activeBookingCountForMobile(clinic.id, request.mobile);
  if (active >= ACTIVE_BOOKING_CAP) {
    return {
      error: `You already have ${active} active bookings here. Please cancel one first.`,
    };
  }

  // Plan quota — soft check up-front so the customer sees a friendly
  // message instead of pushing through into the txn. Missed-call flow
  // has no txn re-check because the failure mode is "clinic is closed
  // for the month," not a race.
  try {
    await assertMonthlyQuota(clinic, clinic.id);
  } catch (e) {
    if (e instanceof QuotaExceededError) {
      return {
        error: "This clinic has reached its monthly booking limit. Please try again next month.",
      };
    }
    throw e;
  }

  const slotTime = new Date(slotIso);
  if (Number.isNaN(slotTime.getTime())) return { error: "Pick a valid time." };

  try {
    await db.transaction(async (tx) => {
      // Re-check the request is still usable.
      const [reqRow] = await tx
        .select()
        .from(schema.bookingRequests)
        .where(eq(schema.bookingRequests.id, request.id))
        .for("update")
        .limit(1);
      if (!reqRow || reqRow.usedAt || reqRow.cancelledAt) {
        throw new Error("Link expired.");
      }
      if (new Date(reqRow.expiresAt).getTime() <= Date.now()) {
        throw new Error("Link expired.");
      }

      // Re-check cap inside the txn.
      const activeBookings = await tx
        .select({ id: schema.bookings.id })
        .from(schema.bookings)
        .innerJoin(
          schema.patients,
          eq(schema.bookings.patientId, schema.patients.id),
        )
        .where(
          and(
            eq(schema.bookings.clinicId, clinic.id),
            eq(schema.patients.mobile, request.mobile),
            ne(schema.bookings.status, "done"),
            ne(schema.bookings.status, "cancelled"),
            ne(schema.bookings.status, "no_show"),
          ),
        );
      if (activeBookings.length >= ACTIVE_BOOKING_CAP) {
        throw new Error(`Booking cap reached (${ACTIVE_BOOKING_CAP}).`);
      }

      // Re-check the slot is still open inside the txn.
      const taken = await takenSlots(clinic.id, formatDate(slotTime));
      if (taken.has(slotTime.toISOString())) {
        throw new Error("That time was just taken — please pick another.");
      }

      // Upsert patient by mobile.
      let patientId = reqRow.patientId ?? undefined;
      if (!patientId) {
        const [existingPatient] = await tx
          .select()
          .from(schema.patients)
          .where(
            and(
              eq(schema.patients.clinicId, clinic.id),
              eq(schema.patients.mobile, request.mobile),
            ),
          )
          .limit(1);
        if (existingPatient) {
          if (existingPatient.name !== name) {
            await tx
              .update(schema.patients)
              .set({ name })
              .where(eq(schema.patients.id, existingPatient.id));
          }
          patientId = existingPatient.id;
        } else {
          const [created] = await tx
            .insert(schema.patients)
            .values({
              clinicId: clinic.id,
              name,
              mobile: request.mobile,
              isNew,
              whatsappOptOut: false,
            })
            .returning();
          patientId = created.id;
        }
      }

      const date = formatDate(slotTime);
      const token = await nextToken(clinic.id, date);

      // Owner-of-record for the booking: the workspace owner (first doctor user).
      const [owner] = await tx
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(
          and(eq(schema.users.clinicId, clinic.id), eq(schema.users.role, "doctor")),
        )
        .limit(1);

      const [booking] = await tx
        .insert(schema.bookings)
        .values({
          clinicId: clinic.id,
          patientId: patientId!,
          date,
          token,
          slotTime,
          reason,
          partySize: 1,
          status: "booked",
          // Missed-call flow is customer-initiated self-serve — bucket
          // with the mobile app for reporting purposes.
          source: "app",
          createdByUserId: owner?.id ?? 0,
        })
        .returning();

      await tx
        .update(schema.bookingRequests)
        .set({ usedAt: nowUtc(), bookingId: booking.id, patientId: patientId! })
        .where(eq(schema.bookingRequests.id, reqRow.id));
    });
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Could not confirm booking.",
    };
  }

  revalidatePath(`/b/${token}`);
  revalidatePath("/queue");
  redirect(`/b/${token}/done${lang === "hi" ? "?lang=hi" : ""}`);
}

export type CancelState = { error?: string; ok?: boolean };

export async function cancelBookingAction(
  _prev: CancelState,
  formData: FormData,
): Promise<CancelState> {
  const token = String(formData.get("token") ?? "");
  const reason = String(formData.get("reason") ?? "").trim() || undefined;
  const lang = formData.get("lang") === "hi" ? "hi" : "en";

  // Same per-IP fuse as confirm — public URL-token gated, IP is the
  // only signal we have to stop bots grinding the endpoint.
  const hdrs = await headers();
  const ip = getClientIp(hdrs);
  const rl = await checkAndIncrement(LIMITS.b_confirm_per_ip, "b_cancel", ip);
  if (!rl.ok) {
    return { error: "Too many attempts. Please wait a bit and try again." };
  }

  const found = await getBookingRequestByToken(token);
  if (!found) return { error: "Link expired." };
  const { request } = found;
  if (!request.bookingId) return { error: "Nothing to cancel." };

  try {
    await cancelBookingFromRequest({ request, reason });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not cancel." };
  }

  revalidatePath(`/b/${token}`);
  revalidatePath("/queue");
  redirect(`/b/${token}/cancel?done=1${lang === "hi" ? "&lang=hi" : ""}`);
}

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}
