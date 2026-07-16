// GET /api/v1/owner/me — who am I?
//
// Returns the authenticated owner's user + clinic info. Mobile calls
// this after login (or on app resume) to hydrate the header and cache
// the clinic name / tenant type / vocab for other screens.

export const dynamic = "force-dynamic";

import { fail, ok, requireOwner } from "@/lib/api-helpers";
import { checkAndIncrement, LIMITS } from "@/lib/rate-limit";

export async function GET(req: Request) {
  const auth = await requireOwner(req);
  if (auth instanceof Response) return auth;

  const rl = await checkAndIncrement(LIMITS.poll_per_user, "owner_me", String(auth.user.id));
  if (!rl.ok) return fail(429, "Too many requests.", "RATE_LIMITED");

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
