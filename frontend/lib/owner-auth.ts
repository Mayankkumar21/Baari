// Owner-side auth for the mobile app's owner segment. Lives alongside
// customer-auth.ts and the existing clinic-staff cookie auth in auth.ts,
// intentionally kept separate:
//
//   - Customer bearer JWTs carry `type: "customer"` — verifyOwnerJwt
//     rejects them, and vice versa. A stolen customer token cannot be
//     used to hit owner endpoints.
//   - The web dashboard cookie session (in auth.ts) has no `type` field
//     at all, so it also can't be accepted here.
//
// Edge-safe — jose only, no bcryptjs.
import { SignJWT, jwtVerify } from "jose";

// Owner sessions are shorter than customer sessions (60 days) because
// staff turnover is faster and a lost/stolen owner token unlocks the
// whole clinic dashboard. 30 days is a reasonable trade-off between
// convenience (nobody wants to re-log in weekly) and blast radius.
const OWNER_SESSION_DAYS = 30;

export type OwnerRole = "doctor" | "receptionist";

export type OwnerSessionPayload = {
  uid: number; // users.id
  cid: number; // clinics.id — the clinic this owner works for
  role: OwnerRole;
  type: "owner";
};

function secret(): Uint8Array {
  const s = process.env.JWT_SECRET || process.env.SECRET_KEY;
  if (!s || s.length < 32) {
    throw new Error("JWT_SECRET env var is required (>= 32 chars)");
  }
  return new TextEncoder().encode(s);
}

export async function issueOwnerJwt(payload: {
  uid: number;
  cid: number;
  role: OwnerRole;
}): Promise<{ token: string; maxAge: number }> {
  const maxAge = OWNER_SESSION_DAYS * 24 * 60 * 60;
  const token = await new SignJWT({ ...payload, type: "owner" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${OWNER_SESSION_DAYS}d`)
    .sign(secret());
  return { token, maxAge };
}

export async function verifyOwnerJwt(
  token: string,
): Promise<OwnerSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (payload.type !== "owner") return null;
    const uid = (payload as { uid?: unknown }).uid;
    const cid = (payload as { cid?: unknown }).cid;
    const role = (payload as { role?: unknown }).role;
    if (typeof uid !== "number" || typeof cid !== "number") return null;
    if (role !== "doctor" && role !== "receptionist") return null;
    return { uid, cid, role, type: "owner" };
  } catch {
    return null;
  }
}
