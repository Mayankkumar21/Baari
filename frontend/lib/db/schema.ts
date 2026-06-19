// Drizzle schema — direct port of app/models.py (SQLModel).
// Names + column types preserved so a single Neon branch can host both stacks.
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

export const subTokenStatus = pgEnum("sub_token_status", [
  "booked",
  "checked_in",
  "in_consult",
  "done",
  "cancelled",
  "no_show",
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
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    clinicId: integer("clinic_id").notNull().references(() => clinics.id),
    role: userRole("role").notNull(),
    mobile: varchar("mobile", { length: 15 }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    name: varchar("name", { length: 80 }).notNull(),
    active: boolean("active").notNull().default(true),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqClinicMobile: uniqueIndex("uq_users_clinic_mobile").on(t.clinicId, t.mobile),
    clinicIdx: index("users_clinic_idx").on(t.clinicId),
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
  },
  (t) => ({
    uniqClinicMobile: uniqueIndex("uq_patients_clinic_mobile").on(t.clinicId, t.mobile),
    clinicIdx: index("patients_clinic_idx").on(t.clinicId),
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
    clinicIdx: index("bookings_clinic_idx").on(t.clinicId),
    dateIdx: index("bookings_date_idx").on(t.date),
    statusIdx: index("bookings_status_idx").on(t.status),
    slotIdx: index("bookings_slot_idx").on(t.slotTime),
  }),
);

export const subTokens = pgTable(
  "sub_tokens",
  {
    id: serial("id").primaryKey(),
    bookingId: integer("booking_id").notNull().references(() => bookings.id),
    suffix: integer("suffix").notNull(),
    name: varchar("name", { length: 80 }).notNull(),
    reason: varchar("reason", { length: 200 }),
    status: subTokenStatus("status").notNull().default("booked"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqBookingSuffix: uniqueIndex("uq_subtokens_booking_suffix").on(t.bookingId, t.suffix),
    bookingIdx: index("subtokens_booking_idx").on(t.bookingId),
  }),
);

export const notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    clinicId: integer("clinic_id").notNull().references(() => clinics.id),
    bookingId: integer("booking_id").references(() => bookings.id),
    subTokenId: integer("sub_token_id").references(() => subTokens.id),
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
export type SubToken = typeof subTokens.$inferSelect;
export type NewSubToken = typeof subTokens.$inferInsert;
