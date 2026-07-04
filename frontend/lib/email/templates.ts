// Email templates — plain HTML strings and text fallbacks. Kept as
// template functions (not React Email components) to skip the extra
// build/runtime overhead — the templates are simple enough that raw
// strings are the pragmatic choice at pilot scale.

type PasswordResetArgs = {
  name: string;
  code: string;
  expiresInMinutes: number;
};

// Password-reset OTP. No clickable link — the code goes back into the
// same UI the reset was triggered from, so nothing to phish.
export function passwordResetEmail(args: PasswordResetArgs): {
  subject: string;
  html: string;
  text: string;
} {
  const { name, code, expiresInMinutes } = args;
  const subject = `Your Baari reset code: ${code}`;
  const text = [
    `Hi ${name},`,
    "",
    `Your Baari password-reset code is: ${code}`,
    "",
    `Enter it on the reset screen to set a new password. The code expires in ${expiresInMinutes} minutes.`,
    "",
    "If you didn't ask for this, ignore this email — nothing will change.",
    "",
    "— Baari",
  ].join("\n");
  const html = codeEmailHtml({
    subject,
    intro: `Hi ${escapeHtml(name)}, someone (hopefully you) asked to reset the password on your Baari owner account.`,
    code,
    codeLabel: "Enter this code on the reset screen:",
    expiresInMinutes,
    footer: "If you didn't ask for this, ignore this email — nothing will change.",
  });
  return { subject, html, text };
}

type EmailVerifyArgs = {
  name: string;
  code: string;
  expiresInMinutes: number;
  // 'add' when the account had no email before; 'change' when replacing
  // one. Copy differs slightly so the message stays honest about what
  // clicking through will do.
  kind: "add" | "change";
};

// Verification OTP for the "add / change email" flow. Sent to the
// candidate address so ownership is proved before we save.
export function emailVerifyEmail(args: EmailVerifyArgs): {
  subject: string;
  html: string;
  text: string;
} {
  const { name, code, expiresInMinutes, kind } = args;
  const subject = `Your Baari verification code: ${code}`;
  const intro =
    kind === "change"
      ? `Hi ${escapeHtml(name)}, someone asked to change your Baari account email to this address.`
      : `Hi ${escapeHtml(name)}, someone asked to add this address as the recovery email on your Baari account.`;
  const text = [
    `Hi ${name},`,
    "",
    `Your Baari verification code is: ${code}`,
    "",
    `Enter it on the Baari dashboard to confirm this email address. The code expires in ${expiresInMinutes} minutes.`,
    "",
    "If you didn't ask for this, ignore this email — no email is stored on your account until the code is entered.",
    "",
    "— Baari",
  ].join("\n");
  const html = codeEmailHtml({
    subject,
    intro,
    code,
    codeLabel: "Enter this code on the Baari dashboard:",
    expiresInMinutes,
    footer:
      "If you didn't ask for this, ignore this email — no email is stored on your account until the code is entered.",
  });
  return { subject, html, text };
}

// ─── Shared HTML shell ──────────────────────────────────────────────────

function codeEmailHtml(args: {
  subject: string;
  intro: string;
  code: string;
  codeLabel: string;
  expiresInMinutes: number;
  footer: string;
}): string {
  const { subject, intro, code, codeLabel, expiresInMinutes, footer } = args;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f6f5f0;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#151417;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f6f5f0;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:12px;border:1px solid #e5e3d8;padding:32px;">
          <tr>
            <td>
              <div style="display:inline-flex;align-items:center;gap:8px;margin-bottom:24px;">
                <span style="display:inline-block;width:28px;height:28px;line-height:28px;text-align:center;background-color:#4c4cde;color:#f5efdf;border-radius:6px;font-weight:700;">B</span>
                <span style="font-size:15px;font-weight:600;color:#151417;">Baari</span>
              </div>
              <p style="font-size:15px;line-height:22px;color:#3a3a40;margin:0 0 20px;">${intro}</p>
              <p style="font-size:13px;line-height:20px;color:#6b6a71;margin:0 0 8px;">${escapeHtml(codeLabel)}</p>
              <div style="font-family:'SF Mono',ui-monospace,Menlo,monospace;font-size:34px;font-weight:600;letter-spacing:8px;color:#151417;background-color:#f6f5f0;border:1px solid #e5e3d8;border-radius:10px;padding:16px 24px;text-align:center;margin:0 0 20px;">${escapeHtml(code)}</div>
              <p style="font-size:13px;line-height:20px;color:#6b6a71;margin:0 0 8px;">The code expires in ${expiresInMinutes} minutes.</p>
              <p style="font-size:13px;line-height:20px;color:#6b6a71;margin:0;">${footer}</p>
            </td>
          </tr>
        </table>
        <p style="font-size:12px;color:#8a8990;margin:16px 0 0;">Sent by Baari · queue &amp; bookings for local businesses</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// Minimal HTML escaping — enough for the interpolations we do (name,
// codes, subjects). Not a general-purpose sanitizer.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
