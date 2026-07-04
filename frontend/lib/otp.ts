// OTP helpers shared by the reset + email-verification flows.
// Codes are 6-digit strings; only their SHA-256 hash is stored in the DB
// so a table dump can't be replayed.

import { randomInt, createHash } from "node:crypto";

// 10 minutes is enough for a distracted owner to grab their phone; short
// enough that a leaked code isn't a long-lived risk.
export const CODE_TTL_MINUTES = 10;

// Cap on wrong-code guesses per row before we refuse further submissions
// on that specific code. 5 keeps guessing infeasible (5/1M) while
// forgiving a typo or two.
export const MAX_ATTEMPTS = 5;

// 6-digit numeric string, zero-padded so "000123" isn't printed as 123
// (which the user could type as "123" and then wonder why it fails).
export function generateOtpCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashOtpCode(raw: string): string {
  // Normalise the user input the same way here as on the write path —
  // strip spaces + dashes so "123 456" verifies against a stored
  // "123456" hash.
  const cleaned = raw.replace(/[\s-]/g, "");
  return createHash("sha256").update(cleaned).digest("hex");
}

export function codeExpiry(): Date {
  return new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000);
}
