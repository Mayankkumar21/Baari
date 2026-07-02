"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { requireDoctor } from "@/lib/session";
import { SESSION_COOKIE, normalizeMobile } from "@/lib/auth";
import { hashPassword, passwordStrength, verifyPassword } from "@/lib/password";
import { createBookingRequest } from "@/lib/services/booking-request";
import { servicesFor } from "@/lib/services/service-types";
import { generateUniqueSlug } from "@/lib/slug";

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
        error: "Enter a valid Indian phone (10 digits, starting with 6, 7, 8 or 9).",
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
    })
    .where(eq(schema.clinics.id, sess.clinic.id));
  revalidatePath("/settings/workspace");
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
  const acceptAppBookings = formData.get("accept_app_bookings") === "on";

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

  await db
    .update(schema.clinics)
    .set({ acceptAppBookings, bookableServices })
    .where(eq(schema.clinics.id, sess.clinic.id));
  revalidatePath("/settings/bookings");
  revalidatePath("/queue");
  return { ok: true };
}

// ─── Opening hours ────────────────────────────────────────────────────────

export type HoursState = { ok?: boolean; error?: string };

type DayBlock = {
  open?: string;
  close?: string;
  closed?: boolean;
  // Optional second range for a midday break (e.g. 9–13 and 17–21).
  open2?: string;
  close2?: string;
};

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

  // Hard delete in FK-reverse order. Tables referencing clinic_id (directly
  // or via booking_id / user_id) must be drained before the parent. All
  // wrapped in a transaction so a partial failure leaves the workspace intact.
  await db.transaction(async (tx) => {
    const childBookingIds = await tx
      .select({ id: schema.bookings.id })
      .from(schema.bookings)
      .where(eq(schema.bookings.clinicId, cid));
    if (childBookingIds.length > 0) {
      await tx
        .delete(schema.subTokens)
        .where(
          inArray(
            schema.subTokens.bookingId,
            childBookingIds.map((r) => r.id),
          ),
        );
    }
    await tx.delete(schema.notifications).where(eq(schema.notifications.clinicId, cid));
    await tx.delete(schema.auditLog).where(eq(schema.auditLog.clinicId, cid));
    await tx.delete(schema.dailySummaries).where(eq(schema.dailySummaries.clinicId, cid));
    await tx.delete(schema.bookings).where(eq(schema.bookings.clinicId, cid));
    await tx.delete(schema.patients).where(eq(schema.patients.clinicId, cid));
    await tx.delete(schema.users).where(eq(schema.users.clinicId, cid));
    await tx.delete(schema.clinics).where(eq(schema.clinics.id, cid));
  });

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
