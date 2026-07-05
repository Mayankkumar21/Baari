"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq, and, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { SESSION_COOKIE, issueSession, normalizeMobile } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { checkAndIncrement, LIMITS } from "@/lib/rate-limit";

export type LoginState = { error?: string };

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const mobileRaw = String(formData.get("mobile") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/queue") || "/queue";

  const mobile = normalizeMobile(mobileRaw);
  if (!mobile || !password) return { error: "Mobile and password required" };

  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "0.0.0.0";

  const ipCheck = await checkAndIncrement(LIMITS.login_per_ip, "login_ip", ip);
  if (!ipCheck.ok) return { error: "Too many login attempts. Try again in a few minutes." };
  const mobCheck = await checkAndIncrement(LIMITS.login_per_mobile, "login_mob", mobile);
  if (!mobCheck.ok) return { error: "Too many login attempts on this number. Try again later." };

  const rows = await db
    .select()
    .from(schema.users)
    .where(and(eq(schema.users.mobile, mobile), eq(schema.users.active, true)));
  if (!rows.length) return { error: "Invalid mobile or password" };

  // Multiple clinics could share a mobile (one user-per-clinic) — try each.
  let match: typeof rows[number] | null = null;
  for (const u of rows) {
    if (await verifyPassword(password, u.passwordHash)) {
      match = u;
      break;
    }
  }
  if (!match) return { error: "Invalid mobile or password" };

  await db
    .update(schema.users)
    .set({ lastLoginAt: new Date() })
    .where(eq(schema.users.id, match.id));

  const { token, maxAge } = await issueSession({
    uid: match.id,
    cid: match.clinicId,
    role: match.role,
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // Strict: cookie is NEVER sent on cross-site navigation. Prevents
    // CSRF attacks that rely on a doctor visiting a malicious page and
    // that page triggering a request back to Baari with the session
    // cookie riding along. Safe here because there's no OAuth callback
    // or cross-origin redirect flow that would break under strict.
    sameSite: "strict",
    path: "/",
    maxAge,
  });

  redirect(next.startsWith("/") ? next : "/queue");
}

export async function logoutAction(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  redirect("/login");
}
