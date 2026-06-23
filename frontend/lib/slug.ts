// Generate URL-safe clinic slugs. Used at signup time + when an owner
// explicitly sets/changes their slug in Settings.

import { sql } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";

// Strip accents, lowercase, replace non-alphanumeric with hyphens,
// collapse repeats, trim, cap at 60.
export function baseSlug(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip combining marks
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "workspace";
}

// Append a short random suffix until we find one that's not in use.
// 4 hex chars = 65k options; collisions effectively impossible at any
// realistic scale, but we still loop just in case.
function rand4(): string {
  return Math.floor(Math.random() * 0xffff)
    .toString(16)
    .padStart(4, "0");
}

export async function generateUniqueSlug(rawName: string): Promise<string> {
  const base = baseSlug(rawName);
  for (let i = 0; i < 8; i++) {
    const candidate = i === 0 ? base : `${base}-${rand4()}`;
    const [existing] = await db
      .select({ id: schema.clinics.id })
      .from(schema.clinics)
      .where(sql`${schema.clinics.slug} = ${candidate}`)
      .limit(1);
    if (!existing) return candidate;
  }
  // Last-resort: suffix with a timestamp.
  return `${base}-${Date.now().toString(36)}`;
}
