import type { Config } from "drizzle-kit";
import { config } from "dotenv";

// drizzle-kit (unlike Next.js) doesn't auto-load .env.local — load it here
// so `npm run db:push` works from a fresh checkout without extra env juggling.
config({ path: ".env.local", override: true });
config({ path: ".env", override: true });

export default {
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  strict: true,
  verbose: true,
} satisfies Config;
