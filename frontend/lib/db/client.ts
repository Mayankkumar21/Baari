// Drizzle client — Neon serverless driver (works on Vercel Edge + Node).
// On local dev, set DATABASE_URL in .env.local to a Neon connection string
// pointing at a separate branch from the Python stack so we don't pollute
// prod data. Schema is otherwise identical so the same DB COULD host both.
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error(
    "DATABASE_URL is required. See .env.example — point at a Neon connection string.",
  );
}

const sql = neon(url);
export const db = drizzle(sql, { schema });
export { schema };
