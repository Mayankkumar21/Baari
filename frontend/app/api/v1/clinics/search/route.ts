// GET /api/v1/clinics/search?q=...&type=clinic
// Public. No auth required (discovery before sign-in).
//
// Rate-limited per IP — the endpoint has no auth so an aggressive
// scraper could otherwise pound it. Response is HTTP-cached at the
// edge for 30s keyed on the full URL (query string included), so
// bursts of the same search reuse the cached body without hitting
// the DB.

export const dynamic = "force-dynamic";

import { checkAndIncrement, LIMITS } from "@/lib/rate-limit";
import { fail, ok } from "@/lib/api-helpers";
import { searchPublicClinics } from "@/lib/services/public-clinics";

const TYPES = ["clinic", "dental", "salon", "spa", "vet", "other"];

export async function GET(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "0.0.0.0";
  const ipCheck = await checkAndIncrement(LIMITS.public_get_per_ip, "pub_get_ip", ip);
  if (!ipCheck.ok) {
    return fail(429, "Slow down — too many requests. Try again in a minute.", "RATE_LIMITED");
  }

  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? undefined;
  const typeParam = url.searchParams.get("type") ?? undefined;
  const tenantType = typeParam && TYPES.includes(typeParam) ? typeParam : undefined;
  const clinics = await searchPublicClinics({ q, tenantType });
  return ok({ clinics }, 200, {
    // Search results shift slowly (new listings, tenant type changes).
    // 30s is short enough that owner Settings changes feel snappy on
    // Discover, long enough to absorb the common "user types slowly,
    // fires 5 identical requests" case.
    "cache-control": "public, s-maxage=30, stale-while-revalidate=15",
  });
}
