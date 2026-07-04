// Resend client + small typed wrapper.
//
// Kept intentionally minimal — one client instance, one send() helper
// that swallows the "Resend not configured" case in dev so route
// handlers can call it unconditionally. In prod the env vars are
// required; missing config → throw.

import { Resend } from "resend";
import { checkAndIncrement, LIMITS } from "@/lib/rate-limit";

// Cached instance so lambdas / Next.js hot reloads don't churn clients.
let cached: Resend | null = null;

function client(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!cached) cached = new Resend(key);
  return cached;
}

// From address. Must be verified on the Resend side; keeping it in env
// lets us swap noreply@baari.tech ↔ noreply@getbaari.in without a code
// change once the domain question settles.
function fromAddress(): string {
  return process.env.RESEND_FROM ?? "Baari <noreply@baari.tech>";
}

export type EmailArgs = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

// Sends via Resend. In dev without RESEND_API_KEY set, logs the intended
// email to console and returns { ok: true, mocked: true } so the reset
// flow can be exercised end-to-end without a live account.
export async function sendEmail(
  args: EmailArgs,
): Promise<{ ok: true; mocked?: boolean; id?: string } | { ok: false; error: string }> {
  const r = client();
  if (!r) {
    console.info("[resend] RESEND_API_KEY not set — logging email instead");
    console.info(`  to: ${args.to}`);
    console.info(`  subject: ${args.subject}`);
    console.info(`  text: ${args.text}`);
    return { ok: true, mocked: true };
  }
  try {
    const { data, error } = await r.emails.send({
      from: fromAddress(),
      to: args.to,
      subject: args.subject,
      html: args.html,
      text: args.text,
    });
    if (error) {
      console.error("[resend] send failed:", error);
      return { ok: false, error: error.message ?? "Resend rejected the email." };
    }
    return { ok: true, id: data?.id };
  } catch (err) {
    console.error("[resend] send crashed:", err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// Send with the shared email rate limits attached. Every outbound email
// should route through this — sendEmail() bypasses limits and is only
// intended for internal helpers that already ran their own checks.
//
// Returns:
//   { ok: true, ... }                        — sent (or mocked)
//   { ok: false, reason: "rate_limit", ... } — caller should treat as
//     silent success in non-oracle flows (forgot-password), or as a
//     surfaced error in authed flows (email/start)
//   { ok: false, reason: "send_failed", ... } — Resend rejected
//
// The recipient address is the key for both hour + day per-recipient
// buckets — lowercased so "Foo@x.com" and "foo@x.com" share a quota.
export async function sendEmailWithLimits(args: EmailArgs): Promise<
  | { ok: true; mocked?: boolean; id?: string }
  | { ok: false; reason: "rate_limit"; scope: "recipient_hour" | "recipient_day" | "global_day" }
  | { ok: false; reason: "send_failed"; error: string }
> {
  const recipientKey = args.to.trim().toLowerCase();

  // Global fuse first — cheapest to check and blocks everything
  // downstream if the app is misbehaving.
  const global = await checkAndIncrement(LIMITS.email_global_day, "email_global");
  if (!global.ok) {
    console.error("[resend] GLOBAL daily email cap hit — refusing send");
    return { ok: false, reason: "rate_limit", scope: "global_day" };
  }

  const rDay = await checkAndIncrement(LIMITS.email_recipient_day, "email_rcpt_d", recipientKey);
  if (!rDay.ok) {
    return { ok: false, reason: "rate_limit", scope: "recipient_day" };
  }

  const rHour = await checkAndIncrement(LIMITS.email_recipient_hour, "email_rcpt_h", recipientKey);
  if (!rHour.ok) {
    return { ok: false, reason: "rate_limit", scope: "recipient_hour" };
  }

  const result = await sendEmail(args);
  if (!result.ok) {
    return { ok: false, reason: "send_failed", error: result.error };
  }
  return result;
}
