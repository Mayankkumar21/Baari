// GET /api/v1/owner/me — who am I?
//
// Returns the authenticated owner's user + clinic info. Mobile calls
// this after login (or on app resume) to hydrate the header and cache
// the clinic name / tenant type / vocab for other screens.

export const dynamic = "force-dynamic";

import { ok, requireOwner } from "@/lib/api-helpers";

export async function GET(req: Request) {
  const auth = await requireOwner(req);
  if (auth instanceof Response) return auth;

  const { user, clinic } = auth;

  return ok({
    user: {
      id: user.id,
      name: user.name,
      role: user.role,
      mobile: user.mobile,
    },
    clinic: {
      id: clinic.id,
      name: clinic.name,
      slug: clinic.slug,
      tenantType: clinic.tenantType ?? "clinic",
      slotLengthMin: clinic.slotLengthMin,
      city: clinic.city,
      address: clinic.address,
      phone: clinic.phone,
    },
  });
}
