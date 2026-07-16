// GET /api/v1/clinics/featured
// Public. Replaces "Near you" until proper geo is built.
//
// Rate-limited per IP because there's no auth to gate it — an
// aggressive scraper could otherwise pound this endpoint. Response
// also cached at the edge for 60s so bursts of legit traffic hit the
// same cached body instead of re-running the DB query.

export const dynamic = "force-dynamic";

import { checkAndIncrement, LIMITS } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/client-ip";
import { fail, ok } from "@/lib/api-helpers";
import { featuredPublicClinics } from "@/lib/services/public-clinics";

export async function GET(req: Request) {
  const ip = getClientIp(req);
  const ipCheck = await checkAndIncrement(LIMITS.public_get_per_ip, "pub_get_ip", ip);
  if (!ipCheck.ok) {
    return fail(429, "Slow down — too many requests. Try again in a minute.", "RATE_LIMITED");
  }

  const clinics = await featuredPublicClinics();
  return ok({ clinics }, 200, {
    // Public list changes rarely (new signups + owner setup toggles).
    // 60s is invisible to users and dramatically cuts DB load under
    // any traffic burst. Serves the same cached body to every IP.
    "cache-control": "public, s-maxage=60, stale-while-revalidate=30",
  });
}
