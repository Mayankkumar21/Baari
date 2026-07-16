// GET /api/v1/clinics/:slug
// Public — but reads optional customer auth so the response can include
// isReturning (used to default "First visit?" on the confirm sheet).
//
// Rate-limited per IP. NOT HTTP-cached because the response varies by
// customer (isReturning field) — a shared cache would leak one
// customer's return-visit status to another. Rate limit alone is
// enough since the underlying DB query is cheap (indexed lookup).

export const dynamic = "force-dynamic";

import { checkAndIncrement, LIMITS } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/client-ip";
import { ERRORS, fail, getCustomer, ok } from "@/lib/api-helpers";
import { getPublicClinicBySlug } from "@/lib/services/public-clinics";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const ip = getClientIp(req);
  const ipCheck = await checkAndIncrement(LIMITS.public_get_per_ip, "pub_get_ip", ip);
  if (!ipCheck.ok) {
    return fail(429, "Slow down — too many requests. Try again in a minute.", "RATE_LIMITED");
  }

  const { slug } = await params;
  const customer = await getCustomer(req);
  const clinic = await getPublicClinicBySlug(slug, customer?.mobile);
  if (!clinic) return ERRORS.NOT_FOUND("Clinic not found or not public.");
  return ok({ clinic });
}
