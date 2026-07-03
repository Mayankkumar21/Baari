// GET /api/health — Railway health check.
//
// Railway pings this on deploy to decide when to swing traffic over.
// Also useful as the target for a Neon-warm-keep cron (see GitHub
// Actions workflow). Doesn't touch the DB by default so the app can
// still boot when the DB is momentarily unreachable.
//
// Add ?db=1 to actually check the connection — used by the ping-cron
// that keeps Neon's compute warm.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { db } from "@/lib/db/client";
import { sql } from "drizzle-orm";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const checkDb = url.searchParams.get("db") === "1";

  if (!checkDb) {
    return Response.json({ ok: true, ts: Date.now() });
  }

  try {
    // Cheapest possible query — no table lookup, just a round-trip
    // to Postgres. Keeps Neon's compute node warm.
    const start = Date.now();
    await db.execute(sql`select 1`);
    const dbMs = Date.now() - start;
    return Response.json({ ok: true, ts: Date.now(), dbMs });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, error: msg }, { status: 503 });
  }
}
