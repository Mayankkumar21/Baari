// GET /api/v1/clinics/:slug/slots?date=YYYY-MM-DD
// Public. Returns only OPEN slots — past + taken filtered server-side.
//
// Rate-limited per IP because there's no auth. NOT HTTP-cached: slot
// availability is real-time (a booking just went through must
// immediately disappear from the picker on the next request) — a 30s
// cache would let two customers see + book the same slot.

export const dynamic = "force-dynamic";

import { clinicToday } from "@/lib/time";
import { checkAndIncrement, LIMITS } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/client-ip";
import { ERRORS, fail, ok } from "@/lib/api-helpers";
import { getPublicSlots } from "@/lib/services/public-clinics";

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
  const url = new URL(req.url);
  const dateParam = url.searchParams.get("date") ?? clinicToday();

  // Validate date format YYYY-MM-DD to avoid SQL surprises.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    return ERRORS.BAD_REQUEST("date must be YYYY-MM-DD");
  }

  const slots = await getPublicSlots({ slug, date: dateParam });
  if (slots === null) return ERRORS.NOT_FOUND("Clinic not found or not public.");
  return ok({ date: dateParam, slots });
}
