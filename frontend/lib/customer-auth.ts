// Customer-side auth for the mobile app. Lives alongside the existing
// clinic-staff auth in lib/auth.ts but is intentionally separate —
// different secret claim shape, different cookie/header path, different
// expiry. A staff JWT can NEVER be used as a customer JWT and vice
// versa because verifyCustomerJwt rejects tokens whose `type` claim
// isn't "customer".
//
// Edge-safe — uses jose only, no bcryptjs.
import { SignJWT, jwtVerify } from "jose";

const CUSTOMER_SESSION_DAYS = 60;

export type CustomerSessionPayload = {
  cuid: number; // customer.id (kept distinct from JWT's reserved `sub`)
  type: "customer";
};

function secret(): Uint8Array {
  const s = process.env.JWT_SECRET || process.env.SECRET_KEY;
  if (!s || s.length < 32) {
    throw new Error("JWT_SECRET env var is required (>= 32 chars)");
  }
  return new TextEncoder().encode(s);
}

export async function issueCustomerJwt(customerId: number): Promise<{
  token: string;
  maxAge: number;
}> {
  const maxAge = CUSTOMER_SESSION_DAYS * 24 * 60 * 60;
  const token = await new SignJWT({ cuid: customerId, type: "customer" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${CUSTOMER_SESSION_DAYS}d`)
    .sign(secret());
  return { token, maxAge };
}

export async function verifyCustomerJwt(
  token: string,
): Promise<CustomerSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (payload.type !== "customer") return null;
    const cuid = (payload as { cuid?: unknown }).cuid;
    if (typeof cuid !== "number") return null;
    return { cuid, type: "customer" };
  } catch {
    return null;
  }
}
