// GET /api/v1/clinics/:slug
// Public. Returns the full clinic detail used by the S4 screen.
export const dynamic = "force-dynamic";

import { ERRORS, ok } from "@/lib/api-helpers";
import { getPublicClinicBySlug } from "@/lib/services/public-clinics";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const clinic = await getPublicClinicBySlug(slug);
  if (!clinic) return ERRORS.NOT_FOUND("Clinic not found or not public.");
  return ok({ clinic });
}
