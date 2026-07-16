// Drizzle client — postgres-js driver so transactions actually work.
//
// We were previously using @neondatabase/serverless (neon-http) which is
// HTTP-based and throws "No transactions support in neon-http driver" the
// moment any code path uses db.transaction(...) — including
// /api/v1/bookings (customer-app create), /b/[token]/details (missed-call
// confirm), /settings/account (delete workspace), and customer-side
// cancel.
//
// postgres-js uses a long-lived TCP pool, supports transactions, and runs
// fine on Vercel's Node.js serverless runtime (we don't use the Edge
// runtime anywhere except middleware, which doesn't touch the DB).
//
// Neon accepts both drivers against the same connection string — no
// migration needed.
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error(
    "DATABASE_URL is required. See .env.example — point at a Neon connection string.",
  );
}

// Railway is a single long-lived Node process serving every incoming
// request concurrently, so the pool needs to be sized for parallel
// queries — not 1 like the old Vercel-serverless model. Bumped to 15
// so a slow /reports render or a Reddit-hug burst doesn't serialise
// the whole app behind a single TCP connection. Neon's pgbouncer
// happily accepts that; `prepare: false` still required because the
// pgbouncer transaction-mode pooling can't hold prepared statements.
const queryClient = postgres(url, {
  prepare: false,
  ssl: "require",
  connect_timeout: 10,
  idle_timeout: 20,
  max: 15,
});

export const db = drizzle(queryClient, { schema });
export { schema };
