// POST /api/v1/owner/login — owner-side mobile app login.
//
// Verifies mobile + password against the `users` table (same source of
// truth as the web dashboard's cookie-auth). On success returns a
// bearer JWT the mobile app stores via SecureStore.
//
// Rate-limited by IP + mobile using the same buckets as the web login,
// so a shared attacker across dashboard + app can't multiply their
// attempt budget.

export const dynamic = "force-dynamic";

import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { normalizeMobile } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { issueOwnerJwt } from "@/lib/owner-auth";
import { checkAndIncrement, LIMITS } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/client-ip";
import { ERRORS, fail, ok, readJson } from "@/lib/api-helpers";

type LoginBody = {
  mobile?: string;
  password?: string;
};

export async function POST(req: Request) {
  try {
    const body = await readJson<LoginBody>(req);
    if (!body?.mobile || !body?.password) {
      return ERRORS.BAD_REQUEST("Mobile and password required.");
    }

    const mobile = normalizeMobile(body.mobile);
    if (!mobile) {
      return ERRORS.BAD_REQUEST("Enter a valid 10-digit mobile.");
    }

    // Rate limiting — both dimensions. Prevents an attacker from either
    // hammering the endpoint from one IP or brute-forcing one mobile
    // across many IPs.
    const ip = getClientIp(req);
    const ipCheck = await checkAndIncrement(LIMITS.login_per_ip, "login_ip", ip);
    if (!ipCheck.ok) {
      return fail(429, "Too many login attempts. Try again in a few minutes.", "RATE_LIMITED");
    }
    const mobCheck = await checkAndIncrement(LIMITS.login_per_mobile, "login_mob", mobile);
    if (!mobCheck.ok) {
      return fail(429, "Too many login attempts on this number. Try again later.", "RATE_LIMITED");
    }

    const rows = await db
      .select()
      .from(schema.users)
      .where(and(eq(schema.users.mobile, mobile), eq(schema.users.active, true)));

    // Same mobile could exist across multiple clinics — try each row's
    // password until one matches. Timing is roughly constant because
    // verifyPassword runs the same bcrypt cost per attempt.
    let match: typeof rows[number] | null = null;
    for (const u of rows) {
      if (await verifyPassword(body.password, u.passwordHash)) {
        match = u;
        break;
      }
    }
    // Uniform error for "no such mobile" and "wrong password" — don't
    // leak which one failed.
    if (!match) {
      return fail(401, "Invalid mobile or password.", "INVALID_CREDENTIALS");
    }

    // Record login timestamp for audit/inactive-user detection.
    await db
      .update(schema.users)
      .set({ lastLoginAt: new Date() })
      .where(eq(schema.users.id, match.id));

    const { token, maxAge } = await issueOwnerJwt({
      uid: match.id,
      cid: match.clinicId,
      role: match.role,
    });

    return ok({
      token,
      maxAge,
      user: {
        id: match.id,
        name: match.name,
        role: match.role,
        clinicId: match.clinicId,
      },
    });
  } catch (err) {
    // Surface the underlying error inline when DEV_AUTH_ENABLED is on so
    // we don't need to dig through Railway logs to diagnose. In prod it
    // still falls through to the generic 500.
    console.error("[owner/login] crashed:", err);
    if (process.env.DEV_AUTH_ENABLED === "true") {
      const msg = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack?.split("\n").slice(0, 5) : undefined;
      return Response.json(
        { ok: false, error: "Login failed on the server.", code: "SERVER", debug: { msg, stack } },
        { status: 500 },
      );
    }
    return ERRORS.SERVER();
  }
}
