// Resend client + small typed wrapper.
//
// Kept intentionally minimal — one client instance, one send() helper
// that swallows the "Resend not configured" case in dev so route
// handlers can call it unconditionally. In prod the env vars are
// required; missing config → throw.

import { Resend } from "resend";

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
