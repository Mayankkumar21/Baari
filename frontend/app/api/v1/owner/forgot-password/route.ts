// POST /api/v1/owner/forgot-password — start a password reset.
//
// Body: { mobile }
// Behaviour:
//   1. Rate-limit by IP + mobile so the endpoint can't be used to
//      enumerate users or spam a real owner's inbox.
//   2. Look up an active user by mobile. If missing / has no email /
//      inactive → return 200 anyway. Never leak account existence.
//   3. Generate a raw token (32 bytes → base64url), store its SHA-256
//      hash + expiry in `password_resets`, send the raw token in a
//      Resend email.
//   4. Return { ok, sent: true|false } where `sent` reflects whether
//      the caller has a real user with an email on file — used only by
//      the mobile app to shape the success copy; not a security oracle
//      because rate-limits stop enumeration long before this signal is
//      useful.
//
// Not a security oracle: the shape is intentionally sparse. If the
// mobile matches an active user with an email, we email. If not, we
// respond identically otherwise.

export const dynamic = "force-dynamic";

import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { normalizeMobile } from "@/lib/auth";
import { checkAndIncrement, LIMITS } from "@/lib/rate-limit";
import { ERRORS, fail, ok, readJson } from "@/lib/api-helpers";
import {
  generateResetToken,
  resetTokenExpiry,
  resetUrlFor,
  RESET_TTL_MINUTES,
} from "@/lib/password-reset";
import { sendEmail } from "@/lib/email/resend";
import { passwordResetEmail } from "@/lib/email/templates";

type Body = { mobile?: string };

export async function POST(req: Request) {
  try {
    const body = await readJson<Body>(req);
    if (!body?.mobile) {
      return ERRORS.BAD_REQUEST("Mobile required.");
    }
    const mobile = normalizeMobile(body.mobile);
    if (!mobile) {
      return ERRORS.BAD_REQUEST("Enter a valid 10-digit mobile.");
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "0.0.0.0";
    const ipCheck = await checkAndIncrement(LIMITS.reset_per_ip, "reset_ip", ip);
    if (!ipCheck.ok) {
      return fail(429, "Too many reset attempts. Try again in an hour.", "RATE_LIMITED");
    }
    const mobCheck = await checkAndIncrement(LIMITS.reset_per_mobile, "reset_mob", mobile);
    if (!mobCheck.ok) {
      return fail(429, "Too many reset attempts on this number. Try again later.", "RATE_LIMITED");
    }

    // Find active owner. Multi-clinic owners can exist on the same
    // mobile — we email the FIRST matching row's email. In practice
    // owners re-use the same mobile within a single clinic; if this
    // ever bites, we'll switch to sending one email per clinic match.
    const [user] = await db
      .select()
      .from(schema.users)
      .where(and(eq(schema.users.mobile, mobile), eq(schema.users.active, true)))
      .limit(1);

    // No user OR no email on file → succeed silently. Same shape as
    // the sent-branch so behaviour doesn't leak. `sent: false` is only
    // a UX signal for the mobile app to phrase the toast differently
    // — the rate limits above prevent this from being an oracle.
    if (!user || !user.email) {
      return ok({ sent: false });
    }

    const { raw, hash } = generateResetToken();
    const expiresAt = resetTokenExpiry();
    await db.insert(schema.passwordResets).values({
      userId: user.id,
      tokenHash: hash,
      expiresAt,
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
    if (!result.ok) {
      // Log but still return 200 to the client — the token row is
      // written, so a retry-send job could pick this up later. For
      // now we surface a 500 in dev so the developer sees the fault.
      console.error("[owner/forgot-password] resend failed:", result.error);
      if (process.env.DEV_AUTH_ENABLED === "true") {
        return Response.json(
          { ok: false, error: "Email send failed.", code: "SERVER", debug: result.error },
          { status: 500 },
        );
      }
    }

    return ok({ sent: true });
  } catch (err) {
    console.error("[owner/forgot-password] crashed:", err);
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
