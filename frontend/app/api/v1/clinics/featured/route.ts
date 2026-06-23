// GET /api/v1/clinics/featured
// Public. Replaces "Near you" until proper geo is built.
export const dynamic = "force-dynamic";

import { ok } from "@/lib/api-helpers";
import { featuredPublicClinics } from "@/lib/services/public-clinics";

export async function GET() {
  const clinics = await featuredPublicClinics();
  return ok({ clinics });
}
