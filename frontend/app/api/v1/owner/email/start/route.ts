// POST /api/v1/owner/email/start — begin add/change email verification.
//
// Body: { email }
// Session-authenticated (session cookie set by the web dashboard). Sends
// a 6-digit code to the CANDIDATE email address so ownership is proved
// before we save it to users.email.

export const dynamic = "force-dynamic";

import { and, eq, ne, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { ERRORS, fail, ok, readJson } from "@/lib/api-helpers";
import { normalizeEmail } from "@/lib/auth";
import { requireSession } from "@/lib/session";
import { CODE_TTL_MINUTES, codeExpiry, generateOtpCode, hashOtpCode } from "@/lib/otp";
import { checkAndIncrement, LIMITS } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email/resend";
import { emailVerifyEmail } from "@/lib/email/templates";

type Body = { email?: string };

export async function POST(req: Request) {
  try {
    // Session comes from the SESSION_COOKIE the dashboard sets on login.
    // We use requireSession rather than requireDoctor so a receptionist
    // can manage their own recovery email too.
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
    if (!email) return ERRORS.VALIDATION("Enter a valid email like you@example.com.");

    // Rate-limit by IP so a compromised session can't spam a target
    // inbox — the reset buckets are already tight enough for this too.
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "0.0.0.0";
    const ipCheck = await checkAndIncrement(LIMITS.reset_per_ip, "email_verify_ip", ip);
    if (!ipCheck.ok) {
      return fail(429, "Too many attempts. Try again in an hour.", "RATE_LIMITED");
    }

    // Duplicate guard — friendlier than the Postgres unique-index trip.
    const [dup] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(
        and(
          eq(schema.users.email, email),
          ne(schema.users.id, sess.user.id),
          sql`${schema.users.email} IS NOT NULL`,
        ),
      )
      .limit(1);
    if (dup) {
      return ERRORS.CONFLICT(
        "Another Baari account is already using this email.",
        "EMAIL_TAKEN",
      );
    }

    const kind: "add" | "change" = sess.user.email ? "change" : "add";
    const code = generateOtpCode();
    await db.insert(schema.emailVerifications).values({
      userId: sess.user.id,
      pendingEmail: email,
      codeHash: hashOtpCode(code),
      expiresAt: codeExpiry(),
    });

    const message = emailVerifyEmail({
      name: sess.user.name,
      code,
      expiresInMinutes: CODE_TTL_MINUTES,
      kind,
    });
    const result = await sendEmail({
      to: email,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
    if (!result.ok) {
      console.error("[owner/email/start] resend failed:", result.error);
      if (process.env.DEV_AUTH_ENABLED === "true") {
        return Response.json(
          { ok: false, error: "Email send failed.", code: "SERVER", debug: result.error },
          { status: 500 },
        );
      }
      return fail(502, "Couldn't send verification email. Try again.", "SEND_FAILED");
    }

    return ok({ sent: true, kind });
  } catch (err) {
    console.error("[owner/email/start] crashed:", err);
    return ERRORS.SERVER();
  }
}
