import type { Config } from "drizzle-kit";
import { config } from "dotenv";

// drizzle-kit (unlike Next.js) doesn't auto-load .env.local — load it here
// so `npm run db:push` works from a fresh checkout without extra env juggling.
config({ path: ".env.local", override: true });
config({ path: ".env", override: true });

// Prefer DIRECT_URL for migrations when set — pooler URLs (Neon/Railway
// PgBouncer) don't support the multi-statement DDL that drizzle-kit push
// emits. DATABASE_URL stays the app's runtime URL (pooled). Falls back
// to DATABASE_URL when DIRECT_URL isn't set (single-URL setups).
const migrationUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "";

export default {
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: migrationUrl },
  strict: true,
  verbose: true,
} satisfies Config;
