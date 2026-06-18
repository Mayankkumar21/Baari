"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db, schema } from "@/lib/db/client";
import { SESSION_COOKIE, issueSession, normalizeMobile } from "@/lib/auth";
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

export type SignupState = { error?: string };

export async function signupAction(_prev: SignupState, formData: FormData): Promise<SignupState> {
  // Honeypot — bots fill every field, real users leave hidden ones empty.
  if (formData.get("website") || formData.get("company_name")) {
    return { error: "Signup blocked." };
  }

  const businessName = String(formData.get("business_name") ?? "").trim();
  const ownerName = String(formData.get("owner_name") ?? "").trim();
  const mobileRaw = String(formData.get("mobile") ?? "");
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
  if (!mobile) return { error: "Enter a valid 10-digit mobile number" };
  const pwErr = passwordStrength(password);
  if (pwErr) return { error: pwErr };

  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "0.0.0.0";

  const ipCheck = await checkAndIncrement(LIMITS.signup_per_ip, "signup_ip", ip);
  if (!ipCheck.ok) return { error: "Too many signups from this network. Try again later." };
  const mobCheck = await checkAndIncrement(LIMITS.signup_per_mobile, "signup_mob", mobile);
  if (!mobCheck.ok) return { error: "Too many signups with this number. Try again later." };

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
        passwordHash: await hashPassword(password),
        name: ownerName,
        active: true,
      })
      .returning();
    userId = user.id;
  } catch (err) {
    console.error("signup error:", err);
    return { error: "Could not create workspace. Maybe the number is already used?" };
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
    sameSite: "lax",
    path: "/",
    maxAge,
  });

  redirect("/setup");
}
