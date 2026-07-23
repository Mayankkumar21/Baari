"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq, and, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { SESSION_COOKIE, issueSession, normalizeMobile } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { checkAndIncrement, LIMITS } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/client-ip";

export type LoginState = { error?: string };

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const mobileRaw = String(formData.get("mobile") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/queue") || "/queue";

  const mobile = normalizeMobile(mobileRaw);
  if (!mobile || !password) return { error: "Mobile and password required" };

  // Wrap the whole DB + password flow in a try/catch so any unexpected
  // failure (DB timeout, bcrypt exception, JWT signing hiccup) surfaces
  // as a friendly form error instead of the raw Next.js crash panel.
  // The `redirect()` at the end throws NEXT_REDIRECT — that's an
  // expected control-flow signal we must re-throw so Next can catch it.
  try {
    const hdrs = await headers();
    const ip = getClientIp(hdrs);

    // Fire the two rate-limit checks + user lookup in parallel. The
    // two limiters and the user select are independent — sequencing
    // them added a full Neon round-trip of latency for no reason.
    // Cold Neon compute made this the difference between a snappy
    // <1s login and the 13-15s "is it frozen?" one users reported.
    const [ipCheck, mobCheck, rows] = await Promise.all([
      checkAndIncrement(LIMITS.login_per_ip, "login_ip", ip),
      checkAndIncrement(LIMITS.login_per_mobile, "login_mob", mobile),
      db
        .select()
        .from(schema.users)
        .where(and(eq(schema.users.mobile, mobile), eq(schema.users.active, true))),
    ]);
    if (!ipCheck.ok) return { error: "Too many login attempts. Try again in a few minutes." };
    if (!mobCheck.ok) return { error: "Too many login attempts on this number. Try again later." };
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

    // Fire-and-forget the lastLoginAt bump. It's a nice-to-have (used
    // by /admin's "last seen" column) but has zero bearing on the
    // outcome of this login — awaiting it just adds a Neon round-trip
    // between successful auth and the redirect. Errors are swallowed;
    // a missed update is preferable to a slower login.
    void db
      .update(schema.users)
      .set({ lastLoginAt: new Date() })
      .where(eq(schema.users.id, match.id))
      .catch((e) => console.warn("[login] lastLoginAt update failed:", e));

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
  } catch (err) {
    // NEXT_REDIRECT is how Next.js implements redirect(); must rethrow
    // so the framework can complete the redirect instead of surfacing
    // it as a "crash".
    if (isNextRedirect(err)) throw err;
    console.error("[login] unexpected error:", err);
    return {
      error: "Something went wrong on our end. Please try again in a moment.",
    };
  }
}

function isNextRedirect(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const digest = (err as { digest?: unknown }).digest;
  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT");
}

export async function logoutAction(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  redirect("/login");
}
