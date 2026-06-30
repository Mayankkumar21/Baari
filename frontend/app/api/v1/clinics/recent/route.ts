// GET /api/v1/clinics/recent
// Returns the distinct public clinics this customer has booked at,
// most-recent first. Powers the "YOUR PLACES" section on Discover.
// Requires customer auth.

export const dynamic = "force-dynamic";

import { ok, requireCustomer } from "@/lib/api-helpers";
import { recentPublicClinicsForCustomer } from "@/lib/services/public-clinics";

export async function GET(req: Request) {
  const auth = await requireCustomer(req);
  if (auth instanceof Response) return auth;
  const clinics = await recentPublicClinicsForCustomer(auth.id);
  return ok({ clinics });
}
