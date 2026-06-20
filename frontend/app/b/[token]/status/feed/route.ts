// JSON endpoint polled every 15s by the live-status screen.
export const dynamic = "force-dynamic";

import { getStatusFeed } from "@/lib/services/status-feed";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const feed = await getStatusFeed(token);
  if (!feed) return Response.json({ ok: false, reason: "not_found" }, { status: 404 });
  return Response.json({ ok: true, feed }, { headers: { "cache-control": "no-store" } });
}
