"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, ne, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { SESSION_COOKIE, issueSession, normalizeEmail, normalizeMobile } from "@/lib/auth";
import { hashPassword, passwordStrength } from "@/lib/password";
import { checkAndIncrement, LIMITS } from "@/lib/rate-limit";

const TENANT_TYPES = ["clinic", "salon", "spa", "dental", "vet", "other"] as const;
type TenantType = (typeof TENANT_TYPES)[number];

const DEFAULT_OPENING_HOURS = {
  mon: { open: "09:00", close: "19:00" },
  tue: { open: "09:00", close: "19:00" },
  wed: { open: "09:00", close: "19:00" },
  thu: { open: "09:00", close: "19:00" },
  fri: { open: "09:00", close: "19:00" },
  sat: { open: "09:00", close: "14:00" },
  sun: { closed: true },
};

// `duplicate` lets the form render a "Sign in instead?" link instead of a
// generic error message.
export type SignupState = { error?: string; duplicate?: boolean };

export async function signupAction(_prev: SignupState, formData: FormData): Promise<SignupState> {
  // Honeypot — bots fill every field, real users leave hidden ones empty.
  if (formData.get("website") || formData.get("company_name")) {
    return { error: "Signup blocked." };
  }

  const businessName = String(formData.get("business_name") ?? "").trim();
  const ownerName = String(formData.get("owner_name") ?? "").trim();
  const mobileRaw = String(formData.get("mobile") ?? "");
  const emailRaw = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const tenantTypeRaw = String(formData.get("tenant_type") ?? "clinic");
  const tenantType: TenantType = (TENANT_TYPES as readonly string[]).includes(tenantTypeRaw)
    ? (tenantTypeRaw as TenantType)
    : "clinic";

  if (businessName.length < 2 || businessName.length > 120) {
    return { error: "Business name is required" };
  }
  if (ownerName.length < 2 || ownerName.length > 80) {
    return { error: "Your name is required" };
  }
  const mobile = normalizeMobile(mobileRaw);
  if (!mobile) return { error: "Enter a valid Indian mobile (10 digits, starting with 6, 7, 8 or 9)." };
  const email = normalizeEmail(emailRaw);
  if (!email) return { error: "Enter a valid recovery email like you@example.com." };
  const pwErr = passwordStrength(password);
  if (pwErr) return { error: pwErr };

  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "0.0.0.0";

  const ipCheck = await checkAndIncrement(LIMITS.signup_per_ip, "signup_ip", ip);
  if (!ipCheck.ok) return { error: "Too many signups from this network. Try again later." };
  const mobCheck = await checkAndIncrement(LIMITS.signup_per_mobile, "signup_mob", mobile);
  if (!mobCheck.ok) return { error: "Too many signups with this number. Try again later." };

  // Pre-check for existing workspace owner on this mobile so we can return a
  // specific "sign in instead" hint rather than the unique-violation noise.
  const [existing] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.mobile, mobile))
    .limit(1);
  if (existing) {
    return {
      duplicate: true,
      error: "This number already has a workspace. Sign in instead?",
    };
  }

  // Same pre-check on email — partial-unique index rejects at INSERT
  // time otherwise, and we want a friendly error not a Postgres string.
  const [emailOwner] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(and(eq(schema.users.email, email), sql`${schema.users.email} IS NOT NULL`))
    .limit(1);
  if (emailOwner) {
    return {
      error: "That recovery email is already tied to another workspace. Use a different one, or sign in to the account that owns it.",
    };
  }

  let clinicId: number;
  let userId: number;
  try {
    const [clinic] = await db
      .insert(schema.clinics)
      .values({
        name: businessName,
        tenantType,
        mobile,
        slotLengthMin: 20,
        openingHours: DEFAULT_OPENING_HOURS,
        closedDays: [],
        noShowThresholdMin: 45,
        retentionDays: 730,
        setupComplete: false,
      })
      .returning();
    clinicId = clinic.id;

    const [user] = await db
      .insert(schema.users)
      .values({
        clinicId,
        role: "doctor",
        mobile,
        // Email is stored unverified on signup — user verifies via OTP from
        // /settings/account before it's usable for password reset. Storing
        // upfront still guarantees we have SOMETHING to recover with, and
        // the duplicate check above prevents cross-account collision.
        email,
        passwordHash: await hashPassword(password),
        name: ownerName,
        active: true,
      })
      .returning();
    userId = user.id;
  } catch (err) {
    // Race window: another signup wins the mobile OR email between our
    // pre-checks and the INSERT. Unique index rejects the loser; map the
    // Postgres error string back to a friendly UI state.
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("uq_users_clinic_mobile")) {
      return {
        duplicate: true,
        error: "This number already has a workspace. Sign in instead?",
      };
    }
    if (msg.includes("uq_users_email")) {
      return {
        error: "That recovery email is already tied to another workspace. Use a different one.",
      };
    }
    if (msg.includes("duplicate key")) {
      // Fallback — some other unique constraint. Rare.
      return { error: "Some detail is already registered. Try again with a different one." };
    }
    console.error("signup error:", err);
    return { error: "Could not create workspace. Try again." };
  }

  const { token, maxAge } = await issueSession({
    uid: userId,
    cid: clinicId,
    role: "doctor",
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // See login/actions.ts for rationale — strict guards against CSRF.
    sameSite: "strict",
    path: "/",
    maxAge,
  });

  redirect("/setup");
}
