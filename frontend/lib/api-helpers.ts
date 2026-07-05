// Shared helpers for /api/v1/* route handlers. The customer JSON API
// uses Bearer-token auth (vs the existing cookie-auth used by
// server-action routes). Everything here is additive — does not touch
// the existing auth or session helpers.

import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { verifyCustomerJwt } from "@/lib/customer-auth";
import { verifyOwnerJwt } from "@/lib/owner-auth";
import type { Customer } from "@/lib/db/schema";

// ─── JSON response shapes ──────────────────────────────────────────────
//
// Consistent body shape: { ok: true, ...data } on success,
// { ok: false, error: "Human message", code?: "MACHINE_CODE" } on failure.
// The mobile app branches on `code` for known cases (SLOT_TAKEN,
// CAP_REACHED, MOBILE_REQUIRED, etc.) and falls back to `error` for
// the toast text.

export function ok<T extends Record<string, unknown>>(
  data: T,
  status = 200,
  extraHeaders?: HeadersInit,
) {
  return Response.json(
    { ok: true, ...data },
    { status, ...(extraHeaders ? { headers: extraHeaders } : {}) },
  );
}

export function fail(status: number, error: string, code?: string) {
  return Response.json({ ok: false, error, code }, { status });
}

export const ERRORS = {
  UNAUTHORIZED: () => fail(401, "Sign in to continue.", "UNAUTHORIZED"),
  BAD_REQUEST: (msg: string) => fail(400, msg, "BAD_REQUEST"),
  NOT_FOUND: (msg = "Not found.") => fail(404, msg, "NOT_FOUND"),
  CONFLICT: (msg: string, code: string) => fail(409, msg, code),
  PRECONDITION: (msg: string, code: string) => fail(412, msg, code),
  VALIDATION: (msg: string) => fail(422, msg, "VALIDATION"),
  RATE_LIMITED: () => fail(429, "Slow down a little.", "RATE_LIMITED"),
  SERVER: () => fail(500, "Something went wrong.", "SERVER"),
};

// ─── Bearer-token extraction + customer resolution ─────────────────────

export function bearerToken(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (!header) return null;
  const [scheme, value] = header.split(/\s+/, 2);
  if (scheme?.toLowerCase() !== "bearer" || !value) return null;
  return value.trim();
}

// Resolve the current customer from the Authorization header. Returns
// null if the header is missing/invalid OR if the customer has been
// soft-deleted. Use requireCustomer() in handlers that must have one.
export async function getCustomer(req: Request): Promise<Customer | null> {
  const token = bearerToken(req);
  if (!token) return null;
  const session = await verifyCustomerJwt(token);
  if (!session) return null;
  const [row] = await db
    .select()
    .from(schema.customers)
    .where(eq(schema.customers.id, session.cuid))
    .limit(1);
  if (!row || row.deletedAt) return null;
  return row;
}

// Convenience: returns either the Customer or a 401 Response. Handlers
// use:
//   const auth = await requireCustomer(req);
//   if (auth instanceof Response) return auth;
//   // ...use auth here as Customer
export async function requireCustomer(req: Request): Promise<Customer | Response> {
  const customer = await getCustomer(req);
  if (!customer) return ERRORS.UNAUTHORIZED();
  return customer;
}

// ─── Safe JSON body parsing ────────────────────────────────────────────

export async function readJson<T = unknown>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

// Public customer shape sent over the wire. Hides internal-only fields
// (deletedAt, etc.) and never exposes another customer's data.
export function customerToPublic(c: Customer) {
  return {
    id: c.id,
    email: c.email,
    name: c.name,
    photoUrl: c.photoUrl,
    mobile: c.mobile,
    language: c.language,
    notifyTurn: c.notifyTurn,
  };
}

// Mask a mobile for any time it appears server-side in logs/responses
// to a different identity. Public profile uses the unmasked own mobile.
export function maskMobile(m: string | null): string | null {
  if (!m || m.length < 6) return m;
  return `${m.slice(0, 2)}••••${m.slice(-4)}`;
}

// ─── Owner (mobile-app receptionist/doctor side) auth ────────────────────
//
// Mirrors requireCustomer above. Distinct code path because owner JWTs
// carry a different `type` claim and resolve to a different table
// (`users` + `clinics`, not `customers`).

export type OwnerAuth = {
  user: typeof schema.users.$inferSelect;
  clinic: typeof schema.clinics.$inferSelect;
};

export async function getOwner(req: Request): Promise<OwnerAuth | null> {
  const token = bearerToken(req);
  if (!token) return null;
  const session = await verifyOwnerJwt(token);
  if (!session) return null;
  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, session.uid))
    .limit(1);
  if (!user || !user.active) return null;
  const [clinic] = await db
    .select()
    .from(schema.clinics)
    .where(eq(schema.clinics.id, session.cid))
    .limit(1);
  if (!clinic) return null;
  // Belt-and-braces: the JWT's cid must still match the user's current
  // clinicId. Prevents a token issued when the user belonged to clinic A
  // from continuing to grant access after they were re-assigned to B.
  if (user.clinicId !== clinic.id) return null;
  return { user, clinic };
}

export async function requireOwner(req: Request): Promise<OwnerAuth | Response> {
  const owner = await getOwner(req);
  if (!owner) return ERRORS.UNAUTHORIZED();
  return owner;
}
