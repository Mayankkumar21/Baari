// Password-reset helpers — token generation + hashing shared between
// the issue endpoint (creates a token) and the redeem endpoint (verifies
// it). Raw tokens never touch the DB — only their SHA-256 hash does.

import { randomBytes, createHash } from "node:crypto";

// 32 raw bytes → 43-char base64url string. Big enough to make guessing
// pointless; short enough to fit comfortably in a URL.
const TOKEN_BYTES = 32;

// Reset link lifetime. Long enough for a distracted owner to check email
// on a slow inbox; short enough that a stolen link isn't a long-lived
// footgun. Kept as a constant so the email template + validation agree.
export const RESET_TTL_MINUTES = 30;

export function generateResetToken(): { raw: string; hash: string } {
  const raw = randomBytes(TOKEN_BYTES).toString("base64url");
  return { raw, hash: hashResetToken(raw) };
}

export function hashResetToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function resetTokenExpiry(): Date {
  return new Date(Date.now() + RESET_TTL_MINUTES * 60 * 1000);
}

// Compose the reset link the email points at. Falls back to the Railway
// URL if BAARI_APP_URL isn't set — Vercel's default preview URLs also
// work because we don't hardcode a scheme+host anywhere else.
export function resetUrlFor(rawToken: string): string {
  const base =
    process.env.BAARI_APP_URL?.replace(/\/$/, "") ??
    "https://baari-tech.vercel.app";
  return `${base}/reset?token=${encodeURIComponent(rawToken)}`;
}
