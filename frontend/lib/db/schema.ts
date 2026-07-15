// Drizzle schema — direct port of app/models.py (SQLModel).
// Names + column types preserved so a single Neon branch can host both stacks.
import { sql } from "drizzle-orm";
import {
  pgTable,
  serial,
  integer,
  text,
  varchar,
  boolean,
  timestamp,
  date,
  jsonb,
  pgEnum,
  uniqueIndex,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["doctor", "receptionist"]);

export const tenantType = pgEnum("tenant_type", [
  "clinic",
  "salon",
  "spa",
  "dental",
  "vet",
  "other",
]);

export const bookingStatus = pgEnum("booking_status", [
  "booked",
  "checked_in",
  "in_consult",
  "done",
  "no_show",
  "cancelled",
]);

export const notificationTrigger = pgEnum("notification_trigger", [
  "booking_confirmed",
  "youre_next",
  "slot_changed",
  "wait_changed",
  "cancelled",
  "no_show",
  "restored",
]);

export const notificationStatus = pgEnum("notification_status", [
  "queued",
  "sent",
  "failed",
]);

// Where a booking originated. Drives the "Bookings by source" totals on
// Reports and future differentiated flows (e.g. app-only auto-cancel
// rules). "app" covers the customer mobile app AND the missed-call
// WhatsApp link (both are customer-initiated self-serve).
export const bookingSource = pgEnum("booking_source", [
  "app",
  "frontdesk",
  "walkin",
]);

export const clinics = pgTable("clinics", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  tenantType: varchar("tenant_type", { length: 20 }).notNull().default("clinic"),
  mobile: varchar("mobile", { length: 15 }),
  address: varchar("address", { length: 300 }),
  slotLengthMin: integer("slot_length_min").notNull().default(20),
  openingHours: jsonb("opening_hours").notNull().default({}),
  closedDays: jsonb("closed_days").notNull().default([]),
  noShowThresholdMin: integer("no_show_threshold_min").notNull().default(45),
  retentionDays: integer("retention_days").notNull().default(730),
  setupComplete: boolean("setup_complete").notNull().default(false),
  // Customer-app discoverability fields. `slug` is a stable URL-safe
  // handle (auto-generated from name on backfill). `publicListing`
  // gates whether the workspace appears in /api/v1/clinics/search —
  // owners opt in explicitly from Settings.
  // `phone` is the customer-facing contact number (tap-to-call on the
  // app + booking page). Distinct from `users.mobile` (owner login).
  // `city` lets us run the "Near you" section without a full geocode.
  slug: varchar("slug", { length: 80 }),
  publicListing: boolean("public_listing").notNull().default(false),
  phone: varchar("phone", { length: 15 }),
  city: varchar("city", { length: 60 }),
  // App-booking controls. Owners can shut off customer-app bookings
  // entirely (safety valve) or restrict which services are bookable
  // through the app while leaving the front-desk workflow untouched.
  // `bookableServices` is null when all services are bookable (default);
  // an explicit array narrows the confirm-sheet's chip options to that
  // subset. Enforced server-side in the public listing + POST /bookings.
  acceptAppBookings: boolean("accept_app_bookings").notNull().default(true),
  bookableServices: jsonb("bookable_services"),
  // Billing plan. `plan` is the SKU the workspace is on; `planTrialEndsAt`
  // is the Pro-trial cutoff (during trial the effective plan resolves up
  // to `pro`). `planSource` records how the current plan was assigned —
  // trial default, self-serve paid, or an admin grant — so the resolver
  // knows whether to auto-downgrade at trial-end. `planGrantedBy` audits
  // admin-issued plans; null for trial/paid rows. See lib/plans.ts for
  // the resolver + gate helpers.
  plan: varchar("plan", { length: 20 }).notNull().default("free"),
  planTrialEndsAt: timestamp("plan_trial_ends_at", { withTimezone: true }),
  planSource: varchar("plan_source", { length: 20 }).notNull().default("trial"),
  planGrantedBy: integer("plan_granted_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uqSlug: uniqueIndex("uq_clinics_slug").on(t.slug),
  publicListingIdx: index("idx_clinics_public_listing").on(t.publicListing),
}));

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    clinicId: integer("clinic_id").notNull().references(() => clinics.id),
    role: userRole("role").notNull(),
    mobile: varchar("mobile", { length: 15 }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    name: varchar("name", { length: 80 }).notNull(),
    // Owner email. Optional at row-creation to keep manual onboarding cheap,
    // but required for the "forgot password" flow — password reset sends
    // a magic link here. Global uniqueness (partial, ignoring NULLs) so
    // one owner can't accidentally register two workspaces on the same
    // inbox without deliberately re-using the address.
    email: varchar("email", { length: 254 }),
    active: boolean("active").notNull().default(true),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    // Stamped when the owner first dismisses the /queue coach-mark
    // tour. Null = tour hasn't been seen. Persisting per-user (rather
    // than per-device localStorage) means the tour only fires once
    // even if the owner logs in on a second device.
    onboardedAt: timestamp("onboarded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqClinicMobile: uniqueIndex("uq_users_clinic_mobile").on(t.clinicId, t.mobile),
    clinicIdx: index("users_clinic_idx").on(t.clinicId),
    uqEmail: uniqueIndex("uq_users_email")
      .on(t.email)
      .where(sql`${t.email} IS NOT NULL`),
  }),
);

// Password reset codes for the owner-side "Forgot password?" flow.
// Stores a SHA-256 of a 6-digit OTP the user has to paste back — the raw
// code never lives here so a DB dump can't be replayed. Rows are short-
// lived (10 min); `attempts` caps wrong-code entries so an attacker
// can't brute-force the 1-in-a-million per code by grinding requests.
export const passwordResets = pgTable(
  "password_resets",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id),
    // SHA-256 of the 6-digit OTP. Column name kept from the earlier
    // link-based scheme so the migration is additive rather than a
    // rename.
    tokenHash: varchar("token_hash", { length: 128 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    // Stamped when the reset actually succeeds. Also lets the audit
    // trail survive after a row is technically consumed.
    usedAt: timestamp("used_at", { withTimezone: true }),
    // Wrong-code counter. Endpoint rejects further guesses on the same
    // row once we cross the threshold — forces the user to request a
    // new code rather than grind through 1M combinations.
    attempts: integer("attempts").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index("password_resets_user_idx").on(t.userId),
    expiresIdx: index("password_resets_expires_idx").on(t.expiresAt),
  }),
);

// Email verification codes for the "add / change email" flow. Sent to
// the CANDIDATE email — not the currently-stored one — so ownership of
// the new inbox is proved before we write it to users.email. Same shape
// as passwordResets except we also carry the pending email so the
// verify endpoint doesn't need a second round-trip.
export const emailVerifications = pgTable(
  "email_verifications",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id),
    // Normalised (lowercase, trimmed) target email. Once verified, this
    // is what we copy into users.email.
    pendingEmail: varchar("pending_email", { length: 254 }).notNull(),
    codeHash: varchar("code_hash", { length: 128 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    attempts: integer("attempts").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index("email_verifications_user_idx").on(t.userId),
    expiresIdx: index("email_verifications_expires_idx").on(t.expiresAt),
  }),
);

export const patients = pgTable(
  "patients",
  {
    id: serial("id").primaryKey(),
    clinicId: integer("clinic_id").notNull().references(() => clinics.id),
    name: varchar("name", { length: 80 }).notNull(),
    mobile: varchar("mobile", { length: 15 }).notNull(),
    isNew: boolean("is_new").notNull().default(true),
    whatsappOptOut: boolean("whatsapp_opt_out").notNull().default(false),
    noShowCount: integer("no_show_count").notNull().default(0),
    consentGiven: boolean("consent_given").notNull().default(false),
    anonymizedAt: timestamp("anonymized_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    // Optional link to the customer-app account (customers.id) for
    // cross-clinic identity. Nullable because:
    //   - patients can be created via the missed-call /b/[token] flow
    //     before the user signs into the customer app
    //   - older rows backfilled by mobile match only — some won't link
    // When set, mobile-change on the customer cascades to update this
    // row's mobile too (keeps booking history linked).
    customerId: integer("customer_id").references(() => customers.id),
  },
  (t) => ({
    uniqClinicMobile: uniqueIndex("uq_patients_clinic_mobile").on(t.clinicId, t.mobile),
    clinicIdx: index("patients_clinic_idx").on(t.clinicId),
    customerIdx: index("patients_customer_idx").on(t.customerId),
  }),
);

export const bookings = pgTable(
  "bookings",
  {
    id: serial("id").primaryKey(),
    clinicId: integer("clinic_id").notNull().references(() => clinics.id),
    patientId: integer("patient_id").notNull().references(() => patients.id),
    date: date("date").notNull(),
    token: integer("token").notNull(),
    slotTime: timestamp("slot_time", { withTimezone: true }).notNull(),
    reason: varchar("reason", { length: 200 }),
    // Third-party booking. Populated when a customer books on behalf
    // of someone else (grandmother booking for grandson, etc.). Both
    // are nullable — a first-party booking leaves them null.
    guestName: varchar("guest_name", { length: 100 }),
    guestMobile: varchar("guest_mobile", { length: 15 }),
    // Where this booking originated. Existing rows backfill to
    // "frontdesk" — dashboard is where all pre-app bookings came from.
    source: bookingSource("source").notNull().default("frontdesk"),
    partySize: integer("party_size").notNull().default(1),
    status: bookingStatus("status").notNull().default("booked"),
    checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    noShowAt: timestamp("no_show_at", { withTimezone: true }),
    restoredAt: timestamp("restored_at", { withTimezone: true }),
    waitEstimateMin: integer("wait_estimate_min"),
    lastWaitNotifiedAt: timestamp("last_wait_notified_at", { withTimezone: true }),
    // Amount the customer paid, in whole rupees. Optional — receptionist
    // types it in the "Mark done" flow if she cares to track revenue.
    // Null means "not tracked", not "zero" — reports SUM only non-null
    // rows so unmarked bookings don't drag the total.
    amountPaidInr: integer("amount_paid_inr"),
    createdByUserId: integer("created_by_user_id").notNull().references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqClinicDateToken: uniqueIndex("uq_bookings_clinic_date_token").on(
      t.clinicId,
      t.date,
      t.token,
    ),
    // Partial unique index: one live booking per (clinic, slot) pair.
    // Excludes cancelled / done / no_show so slots free up when the
    // booking is resolved. Closes the concurrent-booking race that the
    // application-level takenSlots() check leaves open.
    uniqClinicSlotLive: uniqueIndex("uq_bookings_clinic_slot_live")
      .on(t.clinicId, t.slotTime)
      .where(sql`status IN ('booked','checked_in','in_consult')`),
    clinicIdx: index("bookings_clinic_idx").on(t.clinicId),
    dateIdx: index("bookings_date_idx").on(t.date),
    statusIdx: index("bookings_status_idx").on(t.status),
    slotIdx: index("bookings_slot_idx").on(t.slotTime),
  }),
);

export const notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    clinicId: integer("clinic_id").notNull().references(() => clinics.id),
    bookingId: integer("booking_id").references(() => bookings.id),
    patientId: integer("patient_id").notNull().references(() => patients.id),
    trigger: notificationTrigger("trigger").notNull(),
    channel: varchar("channel", { length: 20 }).notNull().default("whatsapp"),
    status: notificationStatus("status").notNull().default("queued"),
    providerMessageId: varchar("provider_message_id", { length: 120 }),
    templateName: varchar("template_name", { length: 80 }),
    payload: jsonb("payload").notNull().default({}),
    failureReason: varchar("failure_reason", { length: 300 }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    clinicIdx: index("notifications_clinic_idx").on(t.clinicId),
    bookingIdx: index("notifications_booking_idx").on(t.bookingId),
    statusIdx: index("notifications_status_idx").on(t.status),
  }),
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: serial("id").primaryKey(),
    clinicId: integer("clinic_id").notNull().references(() => clinics.id),
    userId: integer("user_id").references(() => users.id),
    eventType: varchar("event_type", { length: 60 }).notNull(),
    entityType: varchar("entity_type", { length: 40 }),
    entityId: integer("entity_id"),
    changes: jsonb("changes").notNull().default({}),
    ip: text("ip"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    clinicIdx: index("audit_clinic_idx").on(t.clinicId),
    eventIdx: index("audit_event_idx").on(t.eventType),
    createdIdx: index("audit_created_idx").on(t.createdAt),
  }),
);

export const rateLimitBuckets = pgTable("rate_limit_buckets", {
  bucketKey: varchar("bucket_key", { length: 180 }).primaryKey(),
  count: integer("count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// One-off closures (Diwali, owner vacation, half-day). The booking page
// consults this alongside the recurring openingHours JSON.
export const closedDays = pgTable(
  "closed_days",
  {
    id: serial("id").primaryKey(),
    clinicId: integer("clinic_id").notNull().references(() => clinics.id),
    date: date("date").notNull(),
    reason: varchar("reason", { length: 120 }),
    // Nullable FK — schema hook for per-doctor availability later.
    // Today every row leaves this NULL (workspace-wide closure). When
    // multi-doctor booking ships, non-null values will mean "this
    // specific doctor is unavailable but the rest are open" and the
    // unique-index strategy will get revisited then.
    userId: integer("user_id").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    // Kept as (clinic_id, date) for pilot: only one closure per date
    // per workspace. Multi-doctor era will need to widen this.
    uq: uniqueIndex("uq_closed_clinic_date").on(t.clinicId, t.date),
  }),
);

// Customer-app accounts. Global (not per-clinic) — one row per Google
// account. When a customer books at clinic A, the backend upserts a
// row in `patients` (clinicId=A) using the customer's mobile as the
// link. Clinic-side data stays per-clinic-isolated; the customer side
// follows the same account across every clinic they ever visit.
//
// Distinct from `users` (clinic staff with passwords). Customer auth
// uses Google ID tokens → our Bearer JWT, not cookies.
export const customers = pgTable(
  "customers",
  {
    id: serial("id").primaryKey(),
    googleId: varchar("google_id", { length: 64 }).notNull(),
    email: varchar("email", { length: 200 }).notNull(),
    name: varchar("name", { length: 80 }).notNull(),
    photoUrl: text("photo_url"),
    mobile: varchar("mobile", { length: 15 }),
    // Tracks the last successful change to mobile so we can enforce a
    // ~30-day cooldown (defends against people reclaiming numbers by
    // flipping repeatedly). Null = never changed (i.e. either never
    // set or set once during onboarding).
    mobileChangedAt: timestamp("mobile_changed_at", { withTimezone: true }),
    language: varchar("language", { length: 2 }).notNull().default("en"),
    notifyTurn: boolean("notify_turn").notNull().default(true),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastSignInAt: timestamp("last_sign_in_at", { withTimezone: true }),
  },
  (t) => ({
    uqGoogleId: uniqueIndex("uq_customers_google_id").on(t.googleId),
    emailIdx: index("idx_customers_email").on(t.email),
    // Partial unique: enforces "one active customer per mobile" but
    // lets a soft-deleted account release its mobile. NULL mobiles
    // (account created via Google but mobile not yet entered) are
    // exempt — Postgres treats NULL as distinct in unique indexes.
    uqMobileActive: uniqueIndex("uq_customers_mobile_active")
      .on(t.mobile)
      .where(sql`deleted_at IS NULL`),
  }),
);

// Short-lived tokens issued when a customer is offered a self-serve booking
// link — e.g. after a missed call. Customer taps the SMS link, lands on
// /b/<linkToken>, picks a slot, and the request gets "spent" (bookingId set,
// usedAt stamped). Single-use, time-boxed.
export const bookingRequestSource = pgEnum("booking_request_source", [
  "missed_call",
  "owner_test",
  "manual",
]);

export const bookingRequests = pgTable(
  "booking_requests",
  {
    id: serial("id").primaryKey(),
    clinicId: integer("clinic_id").notNull().references(() => clinics.id),
    mobile: varchar("mobile", { length: 15 }).notNull(),
    patientId: integer("patient_id").references(() => patients.id),
    linkToken: varchar("link_token", { length: 32 }).notNull(),
    source: bookingRequestSource("source").notNull().default("missed_call"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    bookingId: integer("booking_id").references(() => bookings.id),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelReason: varchar("cancel_reason", { length: 200 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uqToken: uniqueIndex("uq_booking_request_token").on(t.linkToken),
    pendingIdx: index("idx_booking_request_pending").on(t.clinicId, t.expiresAt),
  }),
);

export const dailySummaries = pgTable(
  "daily_summaries",
  {
    id: serial("id").primaryKey(),
    clinicId: integer("clinic_id").notNull().references(() => clinics.id),
    date: date("date").notNull(),
    totalBookings: integer("total_bookings").notNull().default(0),
    completed: integer("completed").notNull().default(0),
    noShows: integer("no_shows").notNull().default(0),
    cancellations: integer("cancellations").notNull().default(0),
    avgWaitSeconds: integer("avg_wait_seconds"),
    avgConsultSeconds: integer("avg_consult_seconds"),
    peakHour: integer("peak_hour"),
    firstConsultAt: timestamp("first_consult_at", { withTimezone: true }),
    lastConsultAt: timestamp("last_consult_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqClinicDate: uniqueIndex("uq_summary_clinic_date").on(t.clinicId, t.date),
  }),
);

// Type exports — used across server actions for narrow row types.
export type Clinic = typeof clinics.$inferSelect;
export type NewClinic = typeof clinics.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Patient = typeof patients.$inferSelect;
export type NewPatient = typeof patients.$inferInsert;
export type Booking = typeof bookings.$inferSelect;
export type NewBooking = typeof bookings.$inferInsert;
export type DailySummary = typeof dailySummaries.$inferSelect;
export type NewDailySummary = typeof dailySummaries.$inferInsert;
export type ClosedDay = typeof closedDays.$inferSelect;
export type NewClosedDay = typeof closedDays.$inferInsert;
export type BookingRequest = typeof bookingRequests.$inferSelect;
export type NewBookingRequest = typeof bookingRequests.$inferInsert;
export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
