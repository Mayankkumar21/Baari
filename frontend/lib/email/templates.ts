// Email templates — plain HTML strings and text fallbacks. Kept as
// template functions (not React Email components) to skip the extra
// build/runtime overhead — the templates are simple enough that raw
// strings are the pragmatic choice at pilot scale.

type PasswordResetArgs = {
  name: string;
  resetUrl: string;
  expiresInMinutes: number;
};

export function passwordResetEmail(args: PasswordResetArgs): {
  subject: string;
  html: string;
  text: string;
} {
  const { name, resetUrl, expiresInMinutes } = args;
  const subject = "Reset your Baari password";
  const text = [
    `Hi ${name},`,
    "",
    "Someone asked to reset the password on your Baari owner account. If it was you, open the link below:",
    "",
    resetUrl,
    "",
    `The link expires in ${expiresInMinutes} minutes.`,
    "",
    "If you didn't ask for this, you can ignore this email — nothing will change.",
    "",
    "— Baari",
  ].join("\n");
  const html = `<!DOCTYPE html>
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
              <h1 style="font-size:22px;font-weight:600;margin:0 0 12px;">Reset your password</h1>
              <p style="font-size:15px;line-height:22px;color:#3a3a40;margin:0 0 20px;">Hi ${escapeHtml(name)}, someone (hopefully you) asked to reset the password on your Baari owner account.</p>
              <p style="margin:0 0 24px;">
                <a href="${escapeAttr(resetUrl)}" style="display:inline-block;background-color:#4c4cde;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;font-size:15px;">Set a new password</a>
              </p>
              <p style="font-size:13px;line-height:20px;color:#6b6a71;margin:0 0 8px;">Or paste this link into your browser:</p>
              <p style="font-size:13px;line-height:20px;word-break:break-all;margin:0 0 20px;"><a href="${escapeAttr(resetUrl)}" style="color:#4c4cde;">${escapeHtml(resetUrl)}</a></p>
              <p style="font-size:13px;line-height:20px;color:#6b6a71;margin:0 0 4px;">The link expires in ${expiresInMinutes} minutes.</p>
              <p style="font-size:13px;line-height:20px;color:#6b6a71;margin:0;">If you didn't ask for this, you can ignore this email — nothing will change.</p>
            </td>
          </tr>
        </table>
        <p style="font-size:12px;color:#8a8990;margin:16px 0 0;">Sent by Baari · queue &amp; bookings for local businesses</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
  return { subject, html, text };
}

// Minimal HTML escaping. We only interpolate name and URLs — enough
// coverage without pulling in a full sanitizer.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}
