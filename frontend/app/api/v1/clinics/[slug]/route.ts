// GET /api/v1/clinics/:slug
// Public — but reads optional customer auth so the response can include
// isReturning (used to default "First visit?" on the confirm sheet).
export const dynamic = "force-dynamic";

import { ERRORS, getCustomer, ok } from "@/lib/api-helpers";
import { getPublicClinicBySlug } from "@/lib/services/public-clinics";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const customer = await getCustomer(req);
  const clinic = await getPublicClinicBySlug(slug, customer?.mobile);
  if (!clinic) return ERRORS.NOT_FOUND("Clinic not found or not public.");
  return ok({ clinic });
}
