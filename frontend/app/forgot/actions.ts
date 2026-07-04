"use server";

import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { normalizeMobile } from "@/lib/auth";
import { checkAndIncrement, LIMITS } from "@/lib/rate-limit";
import {
  generateResetToken,
  resetTokenExpiry,
  resetUrlFor,
  RESET_TTL_MINUTES,
} from "@/lib/password-reset";
import { sendEmail } from "@/lib/email/resend";
import { passwordResetEmail } from "@/lib/email/templates";

export type ForgotState = { error?: string; sent?: boolean };

// Server action mirroring POST /api/v1/owner/forgot-password. The API
// route is the canonical entry-point for the mobile app; this action
// gives the web login page an equivalent no-JS-required path.
export async function forgotAction(
  _prev: ForgotState,
  formData: FormData,
): Promise<ForgotState> {
  const mobile = normalizeMobile(String(formData.get("mobile") ?? ""));
  if (!mobile) return { error: "Enter a valid 10-digit mobile." };

  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "0.0.0.0";
  const ipCheck = await checkAndIncrement(LIMITS.reset_per_ip, "reset_ip", ip);
  if (!ipCheck.ok) return { error: "Too many reset attempts. Try again in an hour." };
  const mobCheck = await checkAndIncrement(LIMITS.reset_per_mobile, "reset_mob", mobile);
  if (!mobCheck.ok) return { error: "Too many reset attempts on this number. Try again later." };

  const [user] = await db
    .select()
    .from(schema.users)
    .where(and(eq(schema.users.mobile, mobile), eq(schema.users.active, true)))
    .limit(1);

  // Always report success — same non-oracle stance as the API route.
  if (!user || !user.email) return { sent: true };

  const { raw, hash } = generateResetToken();
  await db.insert(schema.passwordResets).values({
    userId: user.id,
    tokenHash: hash,
    expiresAt: resetTokenExpiry(),
  });

  const email = passwordResetEmail({
    name: user.name,
    resetUrl: resetUrlFor(raw),
    expiresInMinutes: RESET_TTL_MINUTES,
  });
  const result = await sendEmail({
    to: user.email,
    subject: email.subject,
    html: email.html,
    text: email.text,
  });
  if (!result.ok) console.error("[forgot action] resend failed:", result.error);

  return { sent: true };
}
