// Node-only password helpers — kept out of lib/auth.ts so middleware (Edge)
// doesn't import bcryptjs and trip the Edge runtime warning.
import bcrypt from "bcryptjs";

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hashed: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hashed);
  } catch {
    return false;
  }
}

// Password strength — matches app/services/signup_service.py
export function passwordStrength(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters";
  if (!/[A-Za-z]/.test(password)) return "Password must contain a letter";
  if (!/\d/.test(password)) return "Password must contain a number";
  return null;
}
