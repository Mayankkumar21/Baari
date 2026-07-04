"use server";

import { redirect } from "next/navigation";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { hashPassword, passwordStrength } from "@/lib/password";
import { hashResetToken } from "@/lib/password-reset";

export type ResetState = { error?: string };

export async function resetAction(
  _prev: ResetState,
  formData: FormData,
): Promise<ResetState> {
  const token = String(formData.get("token") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!token) return { error: "Missing reset token." };
  if (!password) return { error: "Pick a new password." };
  if (password !== confirm) return { error: "Passwords don't match." };
  const strength = passwordStrength(password);
  if (strength) return { error: strength };

  const hash = hashResetToken(token);
  const [row] = await db
    .select({ reset: schema.passwordResets, user: schema.users })
    .from(schema.passwordResets)
    .innerJoin(schema.users, eq(schema.users.id, schema.passwordResets.userId))
    .where(
      and(
        eq(schema.passwordResets.tokenHash, hash),
        isNull(schema.passwordResets.usedAt),
        gt(schema.passwordResets.expiresAt, new Date()),
        eq(schema.users.active, true),
      ),
    )
    .limit(1);

  if (!row) return { error: "This link has expired or was already used." };

  const passwordHash = await hashPassword(password);
  await db
    .update(schema.passwordResets)
    .set({ usedAt: new Date() })
    .where(eq(schema.passwordResets.id, row.reset.id));
  await db
    .update(schema.users)
    .set({ passwordHash })
    .where(eq(schema.users.id, row.user.id));

  redirect("/login?reset=1");
}
