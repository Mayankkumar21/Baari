// POST /api/v1/owner/email/verify — finish add/change email verification.
//
// Body: { email, code }
// Session-authenticated. Matches (userId, pendingEmail) against the
// newest unused row + verifies the OTP hash. On success writes
// users.email and stamps the row used.

export const dynamic = "force-dynamic";

import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { ERRORS, fail, ok, readJson } from "@/lib/api-helpers";
import { normalizeEmail } from "@/lib/auth";
import { requireSession } from "@/lib/session";
import { hashOtpCode, MAX_ATTEMPTS } from "@/lib/otp";

type Body = { email?: string; code?: string };

export async function POST(req: Request) {
  try {
    const sess = await (async () => {
      try {
        return await requireSession();
      } catch {
        return null;
      }
    })();
    if (!sess) return ERRORS.UNAUTHORIZED();

    const body = await readJson<Body>(req);
    const email = normalizeEmail(body?.email);
    if (!email || !body?.code) {
      return ERRORS.BAD_REQUEST("Email and code required.");
    }

    const [row] = await db
      .select()
      .from(schema.emailVerifications)
      .where(
        and(
          eq(schema.emailVerifications.userId, sess.user.id),
          eq(schema.emailVerifications.pendingEmail, email),
          isNull(schema.emailVerifications.usedAt),
          gt(schema.emailVerifications.expiresAt, new Date()),
        ),
      )
      .orderBy(desc(schema.emailVerifications.createdAt))
      .limit(1);

    if (!row) {
      return fail(410, "Code expired or invalid. Request a new one.", "CODE_INVALID");
    }
    if (row.attempts >= MAX_ATTEMPTS) {
      return fail(
        429,
        "Too many wrong attempts on this code. Request a new one.",
        "CODE_LOCKED",
      );
    }
    if (row.codeHash !== hashOtpCode(body.code)) {
      await db
        .update(schema.emailVerifications)
        .set({ attempts: row.attempts + 1 })
        .where(eq(schema.emailVerifications.id, row.id));
      const left = Math.max(0, MAX_ATTEMPTS - row.attempts - 1);
      return fail(
        401,
        left > 0
          ? `Wrong code. ${left} attempt${left === 1 ? "" : "s"} left.`
          : "Too many wrong attempts on this code. Request a new one.",
        "CODE_WRONG",
      );
    }

    // Commit — write email + mark the row used.
    await db
      .update(schema.emailVerifications)
      .set({ usedAt: new Date() })
      .where(eq(schema.emailVerifications.id, row.id));
    await db
      .update(schema.users)
      .set({ email })
      .where(eq(schema.users.id, sess.user.id));

    return ok({ verified: true, email });
  } catch (err) {
    console.error("[owner/email/verify] crashed:", err);
    return ERRORS.SERVER();
  }
}
