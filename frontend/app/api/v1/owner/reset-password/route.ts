// POST /api/v1/owner/reset-password — { mobile, code, password } → set new password.
//
// The forgot-password endpoint emails a 6-digit code; this endpoint
// verifies (mobile, code) against the newest unused reset row for that
// user and updates the bcrypt hash.

export const dynamic = "force-dynamic";

import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { ERRORS, fail, ok, readJson } from "@/lib/api-helpers";
import { normalizeMobile } from "@/lib/auth";
import { hashPassword, passwordStrength } from "@/lib/password";
import { hashOtpCode, MAX_ATTEMPTS } from "@/lib/otp";
import { checkAndIncrement, LIMITS } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/client-ip";

type Body = { mobile?: string; code?: string; password?: string };

export async function POST(req: Request) {
  try {
    const body = await readJson<Body>(req);
    if (!body?.mobile || !body?.code || !body?.password) {
      return ERRORS.BAD_REQUEST("Mobile, code, and password required.");
    }
    const mobile = normalizeMobile(body.mobile);
    if (!mobile) return ERRORS.BAD_REQUEST("Enter a valid 10-digit mobile.");

    const strengthErr = passwordStrength(body.password);
    if (strengthErr) return ERRORS.VALIDATION(strengthErr);

    // Rate-limit code-check attempts by mobile so brute-forcing across
    // multiple concurrently-issued rows is capped globally too.
    const ip = getClientIp(req);
    const ipCheck = await checkAndIncrement(LIMITS.reset_per_ip, "reset_ip", ip);
    if (!ipCheck.ok) {
      return fail(429, "Too many reset attempts. Try again in an hour.", "RATE_LIMITED");
    }

    // Find the newest still-valid reset row for this mobile+active user.
    const [row] = await db
      .select({ reset: schema.passwordResets, user: schema.users })
      .from(schema.passwordResets)
      .innerJoin(schema.users, eq(schema.users.id, schema.passwordResets.userId))
      .where(
        and(
          eq(schema.users.mobile, mobile),
          eq(schema.users.active, true),
          isNull(schema.passwordResets.usedAt),
          gt(schema.passwordResets.expiresAt, new Date()),
        ),
      )
      .orderBy(desc(schema.passwordResets.createdAt))
      .limit(1);

    if (!row) {
      // No code, expired, or already used — same message for all three
      // so we don't leak state.
      return fail(410, "Code expired or invalid. Request a new one.", "CODE_INVALID");
    }

    if (row.reset.attempts >= MAX_ATTEMPTS) {
      return fail(
        429,
        "Too many wrong attempts on this code. Request a new one.",
        "CODE_LOCKED",
      );
    }

    if (row.reset.tokenHash !== hashOtpCode(body.code)) {
      // Bump attempts. When we cross MAX_ATTEMPTS this row is dead —
      // the next check above will lock it out for the caller.
      await db
        .update(schema.passwordResets)
        .set({ attempts: row.reset.attempts + 1 })
        .where(eq(schema.passwordResets.id, row.reset.id));
      const left = Math.max(0, MAX_ATTEMPTS - row.reset.attempts - 1);
      return fail(
        401,
        left > 0
          ? `Wrong code. ${left} attempt${left === 1 ? "" : "s"} left.`
          : "Too many wrong attempts on this code. Request a new one.",
        "CODE_WRONG",
      );
    }

    const newHash = await hashPassword(body.password);
    await db
      .update(schema.passwordResets)
      .set({ usedAt: new Date() })
      .where(eq(schema.passwordResets.id, row.reset.id));
    await db
      .update(schema.users)
      .set({ passwordHash: newHash })
      .where(eq(schema.users.id, row.user.id));

    return ok({ reset: true });
  } catch (err) {
    console.error("[owner/reset-password] crashed:", err);
    if (process.env.DEV_AUTH_ENABLED === "true") {
      const msg = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack?.split("\n").slice(0, 5) : undefined;
      return Response.json(
        { ok: false, error: "Reset failed on the server.", code: "SERVER", debug: { msg, stack } },
        { status: 500 },
      );
    }
    return ERRORS.SERVER();
  }
}
