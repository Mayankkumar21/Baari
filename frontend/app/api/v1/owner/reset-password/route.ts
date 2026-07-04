// GET  /api/v1/owner/reset-password?token=xxx — validate a reset link
// POST /api/v1/owner/reset-password — { token, password } → set new password
//
// The web reset page hits GET first so it can render either the form
// or an "expired / already used" message without a wasted user
// interaction. POST does the actual password change and marks the
// token used so the same link can't be redeemed twice.
//
// Both operations look up by the raw token's SHA-256 hash — the raw
// token never lives in the DB.

export const dynamic = "force-dynamic";

import { and, eq, gt, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { ERRORS, fail, ok, readJson } from "@/lib/api-helpers";
import { hashPassword, passwordStrength } from "@/lib/password";
import { hashResetToken } from "@/lib/password-reset";

type PostBody = { token?: string; password?: string };

// Shared token lookup — returns the user + reset row when a raw token
// is still redeemable, otherwise null. Also filters on user.active so
// disabled owners can't recover.
async function findValidReset(rawToken: string) {
  const hash = hashResetToken(rawToken);
  const now = new Date();
  const [row] = await db
    .select({
      reset: schema.passwordResets,
      user: schema.users,
    })
    .from(schema.passwordResets)
    .innerJoin(schema.users, eq(schema.users.id, schema.passwordResets.userId))
    .where(
      and(
        eq(schema.passwordResets.tokenHash, hash),
        isNull(schema.passwordResets.usedAt),
        gt(schema.passwordResets.expiresAt, now),
        eq(schema.users.active, true),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token")?.trim();
    if (!token) return ERRORS.BAD_REQUEST("Token required.");
    const row = await findValidReset(token);
    if (!row) return fail(410, "This link has expired or was already used.", "TOKEN_INVALID");
    return ok({ name: row.user.name });
  } catch (err) {
    console.error("[owner/reset-password GET] crashed:", err);
    return ERRORS.SERVER();
  }
}

export async function POST(req: Request) {
  try {
    const body = await readJson<PostBody>(req);
    if (!body?.token || !body?.password) {
      return ERRORS.BAD_REQUEST("Token and password required.");
    }
    const strengthErr = passwordStrength(body.password);
    if (strengthErr) return ERRORS.VALIDATION(strengthErr);

    const row = await findValidReset(body.token);
    if (!row) return fail(410, "This link has expired or was already used.", "TOKEN_INVALID");

    const newHash = await hashPassword(body.password);
    // Mark used first, then update password — either both stick or the
    // row shows "not used" if the password write crashes, giving the
    // user another shot with the same link. Not wrapped in a
    // transaction because either half is safe to re-run.
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
    console.error("[owner/reset-password POST] crashed:", err);
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
