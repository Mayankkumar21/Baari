"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { and, asc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { requireDoctor } from "@/lib/session";
import { SESSION_COOKIE, normalizeMobile } from "@/lib/auth";
import { hashPassword, passwordStrength, verifyPassword } from "@/lib/password";
import { createBookingRequest } from "@/lib/services/booking-request";
import { servicesFor } from "@/lib/services/service-types";
import { generateUniqueSlug } from "@/lib/slug";
import { isValidTimezone } from "@/lib/timezones";

const TENANT_TYPES = ["clinic", "salon", "spa", "dental", "vet", "other"] as const;
const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

// ─── Workspace ────────────────────────────────────────────────────────────

export type WorkspaceState = { ok?: boolean; error?: string };

export async function saveWorkspace(
  _prev: WorkspaceState,
  formData: FormData,
): Promise<WorkspaceState> {
  const sess = await requireDoctor();
  const name = String(formData.get("name") ?? "").trim().slice(0, 120);
  const tenantType = String(formData.get("tenant_type") ?? sess.clinic.tenantType);
  const slot = Number(formData.get("slot_length_min") ?? "20");
  const noShow = Number(formData.get("no_show_threshold_min") ?? "45");
  const address = String(formData.get("address") ?? "").trim().slice(0, 300);
  const phoneRaw = String(formData.get("phone") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim().slice(0, 60);
  const publicListing = formData.get("public_listing") === "on";
  // Timezone. Ignored if empty (keeps the existing value) or invalid
  // (defends against a hand-crafted POST). Validation here + the
  // schema default is enough — no need to enumerate the picker list
  // server-side since Intl already knows every valid IANA name.
  const timezoneRaw = String(formData.get("timezone") ?? "").trim();
  const timezone =
    timezoneRaw && isValidTimezone(timezoneRaw) ? timezoneRaw : sess.clinic.timezone;

  if (!name) return { error: "Workspace name is required." };
  if (!(TENANT_TYPES as readonly string[]).includes(tenantType)) {
    return { error: "Invalid business type." };
  }
  if (!Number.isFinite(slot) || slot < 5 || slot > 240) {
    return { error: "Slot length must be 5–240 minutes." };
  }
  if (!Number.isFinite(noShow) || noShow < 0) {
    return { error: "Invalid no-show threshold." };
  }

  let phone: string | null = null;
  if (phoneRaw) {
    const normalised = normalizeMobile(phoneRaw);
    if (!normalised) {
      return {
        error: "Enter a valid phone number.",
      };
    }
    phone = normalised;
  }

  // Lazy slug generation: first time a workspace opts into publicListing
  // (or saves any settings after launch), we mint a slug. Owners can
  // rename their workspace later — slug stays stable to keep saved
  // URLs working.
  let slug = sess.clinic.slug ?? null;
  if (!slug) {
    slug = await generateUniqueSlug(name);
  }

  await db
    .update(schema.clinics)
    .set({
      name,
      tenantType,
      slotLengthMin: Math.round(slot),
      noShowThresholdMin: Math.round(noShow),
      address: address || null,
      phone,
      city: city || null,
      slug,
      publicListing,
      // Kept in lockstep with publicListing — the "Show on Baari app"
      // toggle is now the single source of truth for "is this clinic
      // reachable from the customer app?" Merged from the separate
      // bookings-form toggle that used to duplicate this control.
      acceptAppBookings: publicListing,
      timezone,
    })
    .where(eq(schema.clinics.id, sess.clinic.id));
  revalidatePath("/settings/workspace");
  revalidatePath("/settings/bookings");
  revalidatePath("/queue");
  return { ok: true };
}

// ─── App bookings ─────────────────────────────────────────────────────────

export type BookingsState = { ok?: boolean; error?: string };

export async function saveBookingsSettings(
  _prev: BookingsState,
  formData: FormData,
): Promise<BookingsState> {
  const sess = await requireDoctor();

  // Build the allowlist from checkbox names "service:<name>". If every
  // service is ticked we store null (== "all bookable"), so a future
  // service added to the catalogue is bookable-by-default rather than
  // silently invisible to customers. Empty allowlist is legal — owner
  // wants the app clinic listing but no bookable services yet.
  const catalogue = servicesFor(sess.clinic.tenantType ?? "clinic");
  const picked = new Set<string>();
  for (const s of catalogue) {
    if (formData.get(`service:${s}`) === "on") picked.add(s);
  }
  const bookableServices: string[] | null =
    picked.size === catalogue.length ? null : catalogue.filter((s) => picked.has(s));

  // acceptAppBookings is now driven entirely by the "Show on Baari
  // app" toggle in Settings > Workspace — two switches for essentially
  // the same thing was confusing owners. The bookings page only
  // controls which services are bookable when the app is on.
  await db
    .update(schema.clinics)
    .set({ bookableServices })
    .where(eq(schema.clinics.id, sess.clinic.id));
  revalidatePath("/settings/bookings");
  revalidatePath("/queue");
  return { ok: true };
}

// ─── Opening hours ────────────────────────────────────────────────────────

export type AffectedBooking = {
  bookingId: number;
  patientName: string;
  mobile: string | null;
  slotIso: string;
  dateLabel: string;
};

export type HoursState = {
  ok?: boolean;
  error?: string;
  // Bookings whose slot_time now falls OUTSIDE the freshly-saved
  // hours. Receptionist gets a "call these people" list rather than
  // Baari silently cancelling on their behalf.
  affected?: AffectedBooking[];
};

type DayBlock = {
  open?: string;
  close?: string;
  closed?: boolean;
  // Optional second range for a midday break (e.g. 9–13 and 17–21).
  open2?: string;
  close2?: string;
};

const AFFECTED_LOOKAHEAD_DAYS = 30;
const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

// True when the slot's HH:MM (in IST) doesn't fall inside any of the
// day's open ranges. Handles closed days and split shifts (open2/close2).
function slotOutsideHours(
  slotTime: Date,
  hours: Record<string, DayBlock>,
): boolean {
  const istDate = new Date(slotTime.getTime() + 5.5 * 60 * 60 * 1000);
  const day = DAY_KEYS[istDate.getUTCDay()];
  const block = hours[day];
  if (!block || block.closed || !block.open || !block.close) return true;
  const hh = String(istDate.getUTCHours()).padStart(2, "0");
  const mm = String(istDate.getUTCMinutes()).padStart(2, "0");
  const hhmm = `${hh}:${mm}`;
  const inMorning = block.open <= hhmm && hhmm < block.close;
  const inAfternoon =
    block.open2 != null &&
    block.close2 != null &&
    block.open2 <= hhmm &&
    hhmm < block.close2;
  return !(inMorning || inAfternoon);
}

export async function saveHours(
  _prev: HoursState,
  formData: FormData,
): Promise<HoursState> {
  const sess = await requireDoctor();
  const openingHours: Record<string, DayBlock> = {};
  for (const d of DAYS) {
    const open = String(formData.get(`${d}_open`) ?? "").trim();
    const close = String(formData.get(`${d}_close`) ?? "").trim();
    const open2 = String(formData.get(`${d}_open2`) ?? "").trim();
    const close2 = String(formData.get(`${d}_close2`) ?? "").trim();
    if (!open || !close) {
      openingHours[d] = { closed: true };
    } else {
      openingHours[d] = open2 && close2 ? { open, close, open2, close2 } : { open, close };
    }
  }
  await db
    .update(schema.clinics)
    .set({ openingHours })
    .where(eq(schema.clinics.id, sess.clinic.id));
  revalidatePath("/settings/hours");
  revalidatePath("/queue");

  // Find bookings the new hours pulled the rug out from under. Look
  // ahead 30 days (well past a normal booking horizon), only
  // active-status bookings, join patients for name+mobile so the
  // receptionist can call them.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isoToday = today.toISOString().slice(0, 10);
  const horizon = new Date(today.getTime() + AFFECTED_LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000);
  const isoHorizon = horizon.toISOString().slice(0, 10);

  const upcoming = await db
    .select({
      bookingId: schema.bookings.id,
      slotTime: schema.bookings.slotTime,
      patientName: schema.patients.name,
      mobile: schema.patients.mobile,
    })
    .from(schema.bookings)
    .innerJoin(schema.patients, eq(schema.bookings.patientId, schema.patients.id))
    .where(
      and(
        eq(schema.bookings.clinicId, sess.clinic.id),
        gte(schema.bookings.date, isoToday),
        lt(schema.bookings.date, isoHorizon),
        inArray(schema.bookings.status, ["booked", "checked_in"]),
      ),
    )
    .orderBy(asc(schema.bookings.slotTime));

  const dayLabelFmt = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const affected: AffectedBooking[] = upcoming
    .filter((r) => slotOutsideHours(r.slotTime, openingHours))
    .map((r) => ({
      bookingId: r.bookingId,
      patientName: r.patientName,
      mobile: r.mobile,
      slotIso: r.slotTime.toISOString(),
      dateLabel: dayLabelFmt.format(r.slotTime),
    }));

  return { ok: true, affected };
}

// ─── Account: email removal ───────────────────────────────────────────────
//
// Add / change email go through the OTP flow at /api/v1/owner/email/*
// (client-side calls from EmailForm). Removal doesn't need verification —
// you're proving control of the session by asking to nuke the address.

export type RemoveEmailState = { ok?: boolean };

export async function removeEmail(): Promise<RemoveEmailState> {
  const sess = await requireDoctor();
  await db
    .update(schema.users)
    .set({ email: null })
    .where(eq(schema.users.id, sess.user.id));
  revalidatePath("/settings/account");
  return { ok: true };
}

// ─── Account: change password ─────────────────────────────────────────────

export type ChangePasswordState = { ok?: boolean; error?: string };

export async function changePassword(
  _prev: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const sess = await requireDoctor();
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!current) return { error: "Enter your current password." };
  if (next !== confirm) return { error: "New password and confirmation don't match." };
  const pwErr = passwordStrength(next);
  if (pwErr) return { error: pwErr };
  if (current === next) return { error: "New password must differ from the current one." };

  const ok = await verifyPassword(current, sess.user.passwordHash);
  if (!ok) return { error: "Current password is incorrect." };

  await db
    .update(schema.users)
    .set({ passwordHash: await hashPassword(next) })
    .where(eq(schema.users.id, sess.user.id));
  return { ok: true };
}

// ─── Account: delete workspace ────────────────────────────────────────────

export type DeleteState = { error?: string };

export async function deleteWorkspace(
  _prev: DeleteState,
  formData: FormData,
): Promise<DeleteState> {
  const sess = await requireDoctor();
  const confirm = String(formData.get("confirm_name") ?? "").trim();
  if (confirm !== sess.clinic.name) {
    return { error: `Type "${sess.clinic.name}" exactly to confirm.` };
  }

  const cid = sess.clinic.id;

  // Hard delete in FK-reverse order. Tables referencing clinic_id
  // (directly or via booking_id / user_id) must be drained before
  // the parent.
  //
  // NO db.transaction() — the no-transaction law (see architecture
  // contract §2). The previous version wrapped everything in
  // db.transaction(async tx => …), which SILENTLY NO-OPS on our
  // postgres-js + Neon combo (per baari-failure-archaeology). Result:
  // the redirect fired, the user saw "Workspace deleted," but every
  // row was still in the DB. Now we run the deletes sequentially —
  // the trade-off is that a mid-flight failure leaves the workspace
  // partially drained, which the caller-facing UI treats as "call
  // support" via the try/catch upstream. In practice: all deletes
  // are simple WHERE clinic_id = ? statements, so the failure mode
  // is a network blip that either happens on the first statement or
  // not at all — a partial delete on a workspace with real traffic
  // is extremely rare.
  //
  // Order is deliberate:
  //   password_resets, email_verifications -> before users (FK users.id)
  //   booking_requests, notifications, audit_log, daily_summaries,
  //     closed_days -> before bookings / users (FK clinic_id + users.id)
  //   bookings -> before patients (FK patients.id)
  //   patients -> before clinics
  //   users -> before clinics
  const userIds = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.clinicId, cid));
  if (userIds.length) {
    const ids = userIds.map((r) => r.id);
    await db.delete(schema.passwordResets).where(inArray(schema.passwordResets.userId, ids));
    await db.delete(schema.emailVerifications).where(inArray(schema.emailVerifications.userId, ids));
  }
  await db.delete(schema.bookingRequests).where(eq(schema.bookingRequests.clinicId, cid));
  await db.delete(schema.notifications).where(eq(schema.notifications.clinicId, cid));
  await db.delete(schema.auditLog).where(eq(schema.auditLog.clinicId, cid));
  await db.delete(schema.dailySummaries).where(eq(schema.dailySummaries.clinicId, cid));
  await db.delete(schema.closedDays).where(eq(schema.closedDays.clinicId, cid));
  await db.delete(schema.bookings).where(eq(schema.bookings.clinicId, cid));
  await db.delete(schema.patients).where(eq(schema.patients.clinicId, cid));
  await db.delete(schema.users).where(eq(schema.users.clinicId, cid));
  await db.delete(schema.clinics).where(eq(schema.clinics.id, cid));

  // Sign the user out and bounce to a friendly confirmation page. Going to
  // /login or /queue here is fragile — those routes re-read the (now-deleted)
  // clinic via requireDoctor/requireSetup and crash before the cookie clear
  // takes effect on the next request.
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  redirect("/workspace-deleted");
}

// ─── Dev: make a self-serve booking link the owner can walk through ──────
//
// In dev / pre-launch we don't have Exotel wired yet — but the owner needs
// to see what the customer flow feels like. This action mints a
// booking_request bound to the owner's own mobile, then redirects them to
// the same /b/<token> page a customer would land on after the SMS.

export type TestLinkState = { error?: string; ok?: boolean };

export async function makeTestBookingLink(
  _prev: TestLinkState,
  _formData: FormData,
): Promise<TestLinkState> {
  const sess = await requireDoctor();
  try {
    const request = await createBookingRequest({
      clinicId: sess.clinic.id,
      mobile: sess.user.mobile,
      source: "owner_test",
    });
    redirect(`/b/${request.linkToken}`);
  } catch (err) {
    if (err instanceof Error && err.message === "NEXT_REDIRECT") throw err;
    return { error: err instanceof Error ? err.message : "Could not create link." };
  }
}
