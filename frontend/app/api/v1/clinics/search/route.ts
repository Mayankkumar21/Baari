// GET /api/v1/clinics/search?q=...&type=clinic
// Public. No auth required (discovery before sign-in).
export const dynamic = "force-dynamic";

import { ok } from "@/lib/api-helpers";
import { searchPublicClinics } from "@/lib/services/public-clinics";

const TYPES = ["clinic", "dental", "salon", "spa", "vet", "other"];

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? undefined;
  const typeParam = url.searchParams.get("type") ?? undefined;
  const tenantType = typeParam && TYPES.includes(typeParam) ? typeParam : undefined;
  const clinics = await searchPublicClinics({ q, tenantType });
  return ok({ clinics });
}
