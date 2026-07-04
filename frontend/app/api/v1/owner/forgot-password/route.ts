// POST /api/v1/owner/forgot-password — start the OTP reset flow.
//
// Body: { mobile }
// Behaviour:
//   1. Rate-limit by IP + mobile so the endpoint can't enumerate users
//      or spam a real owner's inbox.
//   2. Look up an active user by mobile. If missing / has no email /
//      inactive → return 200 with sent:false. Never leak account
//      existence.
//   3. Generate a 6-digit code, store its SHA-256 hash + 10-min expiry
//      in `password_resets`, email the RAW code to user.email via
//      Resend.
//   4. Return { ok, sent: true|false } where `sent` reflects whether
//      we actually sent — used only by the client to shape success
//      copy; rate-limits stop enumeration long before this signal is
//      useful.

export const dynamic = "force-dynamic";

import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { normalizeMobile } from "@/lib/auth";
import { checkAndIncrement, LIMITS } from "@/lib/rate-limit";
import { ERRORS, fail, ok, readJson } from "@/lib/api-helpers";
import { CODE_TTL_MINUTES, codeExpiry, generateOtpCode, hashOtpCode } from "@/lib/otp";
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

    // Multi-clinic owners can exist on the same mobile — we send to
    // the first matching row's email. Every clinic under that mobile
    // will accept the same reset code because they all resolve to the
    // same user row for verification.
    const [user] = await db
      .select()
      .from(schema.users)
      .where(and(eq(schema.users.mobile, mobile), eq(schema.users.active, true)))
      .limit(1);

    if (!user || !user.email) {
      return ok({ sent: false });
    }

    const code = generateOtpCode();
    await db.insert(schema.passwordResets).values({
      userId: user.id,
      tokenHash: hashOtpCode(code),
      expiresAt: codeExpiry(),
    });

    const email = passwordResetEmail({
      name: user.name,
      code,
      expiresInMinutes: CODE_TTL_MINUTES,
    });
    const result = await sendEmail({
      to: user.email,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
    if (!result.ok) {
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
