// GET /api/v1/clinics/recent
// Returns the distinct public clinics this customer has booked at,
// most-recent first. Powers the "YOUR PLACES" section on Discover.
// Requires customer auth.

export const dynamic = "force-dynamic";

import { fail, ok, requireCustomer } from "@/lib/api-helpers";
import { recentPublicClinicsForCustomer } from "@/lib/services/public-clinics";
import { checkAndIncrement, LIMITS } from "@/lib/rate-limit";

export async function GET(req: Request) {
  const auth = await requireCustomer(req);
  if (auth instanceof Response) return auth;

  const rl = await checkAndIncrement(LIMITS.poll_per_user, "recent", String(auth.id));
  if (!rl.ok) return fail(429, "Too many requests.", "RATE_LIMITED");

  const clinics = await recentPublicClinicsForCustomer(auth.id);
  return ok({ clinics });
}
