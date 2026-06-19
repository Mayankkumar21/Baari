// Sub-tokens (family members). Port of app/services/subtoken_service.py.
//
// Sub-tokens hang off a parent booking. Same patient family, same queue slot,
// but each member gets their own consult and a T<n>.<m> label. The state
// machine mirrors the parent's: booked → in_consult → done, with cancel as a
// terminal state. Auto-promotion picks the lowest-suffix pending sub-token
// inside a group before moving on to the next checked-in booking.
import { and, asc, eq, inArray, max } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { nowUtc } from "@/lib/time";
import type { Booking, SubToken } from "@/lib/db/schema";

export const MAX_SUB_TOKENS = 5;

export class SubTokenError extends Error {}

async function loadBookingForSub(
  bookingId: number,
  clinicId: number,
): Promise<Booking> {
  const [b] = await db
    .select()
    .from(schema.bookings)
    .where(
      and(eq(schema.bookings.id, bookingId), eq(schema.bookings.clinicId, clinicId)),
    )
    .limit(1);
  if (!b) throw new SubTokenError("Parent booking not found.");
  if (b.status === "cancelled" || b.status === "no_show") {
    throw new SubTokenError("Cannot add sub-tokens to a cancelled or no-show booking.");
  }
  return b;
}

async function nextSuffix(bookingId: number): Promise<number> {
  const [row] = await db
    .select({ max: max(schema.subTokens.suffix) })
    .from(schema.subTokens)
    .where(eq(schema.subTokens.bookingId, bookingId));
  return (row?.max ?? 0) + 1;
}

export async function addSubToken(args: {
  clinicId: number;
  bookingId: number;
  name: string;
  reason: string | null;
}): Promise<SubToken> {
  const name = args.name.trim();
  if (!name || name.length > 80) {
    throw new SubTokenError("Name is required (max 80 characters).");
  }
  if (args.reason && args.reason.length > 200) {
    throw new SubTokenError("Reason must be 200 characters or fewer.");
  }

  const booking = await loadBookingForSub(args.bookingId, args.clinicId);
  if (booking.status === "done") {
    // PRD: adding sub-tokens once the group has fully closed is disallowed —
    // start a new booking instead. A "done" parent still accepts adds as long
    // as at least one sub-token is still pending or in-consult.
    const [pending] = await db
      .select({ id: schema.subTokens.id })
      .from(schema.subTokens)
      .where(
        and(
          eq(schema.subTokens.bookingId, booking.id),
          inArray(schema.subTokens.status, ["booked", "in_consult"]),
        ),
      )
      .limit(1);
    if (!pending) {
      throw new SubTokenError("This booking is finished — start a new booking instead.");
    }
  }

  const suffix = await nextSuffix(booking.id);
  if (suffix > MAX_SUB_TOKENS) {
    throw new SubTokenError(`A booking can have at most ${MAX_SUB_TOKENS} sub-tokens.`);
  }

  const [created] = await db
    .insert(schema.subTokens)
    .values({
      bookingId: booking.id,
      suffix,
      name,
      reason: args.reason || null,
      status: "booked",
    })
    .returning();
  return created;
}

export async function cancelSubToken(args: {
  clinicId: number;
  subTokenId: number;
}): Promise<SubToken> {
  const [sub] = await db
    .select()
    .from(schema.subTokens)
    .where(eq(schema.subTokens.id, args.subTokenId))
    .limit(1);
  if (!sub) throw new SubTokenError("Sub-token not found.");
  const [parent] = await db
    .select({ clinicId: schema.bookings.clinicId })
    .from(schema.bookings)
    .where(eq(schema.bookings.id, sub.bookingId))
    .limit(1);
  if (!parent || parent.clinicId !== args.clinicId) {
    throw new SubTokenError("Sub-token not found.");
  }
  if (sub.status === "done" || sub.status === "cancelled" || sub.status === "no_show") {
    throw new SubTokenError("This sub-token is already closed.");
  }
  const [updated] = await db
    .update(schema.subTokens)
    .set({ status: "cancelled", cancelledAt: nowUtc() })
    .where(eq(schema.subTokens.id, args.subTokenId))
    .returning();
  return updated;
}

export async function markSubTokenDone(args: {
  clinicId: number;
  subTokenId: number;
}): Promise<{ sub: SubToken; bookingId: number }> {
  const [sub] = await db
    .select()
    .from(schema.subTokens)
    .where(eq(schema.subTokens.id, args.subTokenId))
    .limit(1);
  if (!sub) throw new SubTokenError("Sub-token not found.");
  const [parent] = await db
    .select({ clinicId: schema.bookings.clinicId })
    .from(schema.bookings)
    .where(eq(schema.bookings.id, sub.bookingId))
    .limit(1);
  if (!parent || parent.clinicId !== args.clinicId) {
    throw new SubTokenError("Sub-token not found.");
  }
  if (sub.status !== "in_consult") {
    throw new SubTokenError("Only the currently-consulting sub-token can be marked done.");
  }
  const [updated] = await db
    .update(schema.subTokens)
    .set({ status: "done", completedAt: nowUtc() })
    .where(eq(schema.subTokens.id, args.subTokenId))
    .returning();
  return { sub: updated, bookingId: sub.bookingId };
}

export async function startSubToken(args: {
  clinicId: number;
  subTokenId: number;
}): Promise<SubToken> {
  const [sub] = await db
    .select()
    .from(schema.subTokens)
    .where(eq(schema.subTokens.id, args.subTokenId))
    .limit(1);
  if (!sub) throw new SubTokenError("Sub-token not found.");
  const [parent] = await db
    .select({ clinicId: schema.bookings.clinicId, date: schema.bookings.date })
    .from(schema.bookings)
    .where(eq(schema.bookings.id, sub.bookingId))
    .limit(1);
  if (!parent || parent.clinicId !== args.clinicId) {
    throw new SubTokenError("Sub-token not found.");
  }
  if (sub.status !== "booked") {
    throw new SubTokenError("Sub-token isn't pending.");
  }
  // Concurrency guard — only one consult at a time, parent or sub.
  const [activeParent] = await db
    .select({ id: schema.bookings.id })
    .from(schema.bookings)
    .where(
      and(
        eq(schema.bookings.clinicId, args.clinicId),
        eq(schema.bookings.date, parent.date),
        eq(schema.bookings.status, "in_consult"),
      ),
    )
    .limit(1);
  if (activeParent && activeParent.id !== sub.bookingId) {
    throw new SubTokenError("Another consult is already active.");
  }
  const [activeSub] = await db
    .select({ id: schema.subTokens.id })
    .from(schema.subTokens)
    .where(
      and(
        eq(schema.subTokens.bookingId, sub.bookingId),
        eq(schema.subTokens.status, "in_consult"),
      ),
    )
    .limit(1);
  if (activeSub) {
    throw new SubTokenError("Another sub-token from this group is already in consult.");
  }
  const [updated] = await db
    .update(schema.subTokens)
    .set({ status: "in_consult", startedAt: nowUtc() })
    .where(eq(schema.subTokens.id, args.subTokenId))
    .returning();
  return updated;
}
