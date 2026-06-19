// Server-only session helpers. Read the JWT cookie, decode, fetch user/clinic.
import "server-only";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db, schema } from "@/lib/db/client";
import { SESSION_COOKIE, decodeSession, type SessionPayload } from "@/lib/auth";
import type { Clinic, User } from "@/lib/db/schema";

export type Session = {
  payload: SessionPayload;
  user: User;
  clinic: Clinic;
};

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  const tok = jar.get(SESSION_COOKIE)?.value;
  if (!tok) return null;
  const payload = await decodeSession(tok);
  if (!payload) return null;

  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, payload.uid))
    .limit(1);
  if (!user || !user.active) return null;
  const [clinic] = await db
    .select()
    .from(schema.clinics)
    .where(eq(schema.clinics.id, payload.cid))
    .limit(1);
  if (!clinic) return null;
  return { payload, user, clinic };
}

export async function requireSession(): Promise<Session> {
  const sess = await getSession();
  if (!sess) redirect("/login");
  return sess;
}

export async function requireSetup(): Promise<Session> {
  const sess = await requireSession();
  if (!sess.clinic.setupComplete) redirect("/setup");
  return sess;
}

export async function requireDoctor(): Promise<Session> {
  const sess = await requireSession();
  if (sess.user.role !== "doctor") redirect("/queue");
  return sess;
}
