// Billing plan resolver + gate helpers.
//
// Data model (see clinics.plan* in lib/db/schema.ts):
//   plan               — the SKU the workspace is on ('free'|'growth'|'pro')
//   planTrialEndsAt    — Pro-trial cutoff; null after trial or if never trialed
//   planSource         — 'trial' | 'paid' | 'admin_grant'
//   planGrantedBy      — user id of the admin who issued the grant (audit)
//
// Resolution rule: while planTrialEndsAt is in the future, the workspace's
// effective plan is 'pro' regardless of the base `plan` column — that's how
// every new signup gets 60 days of Pro without touching billing. Once the
// trial expires, `plan` alone drives the resolution. An admin-grant never
// downgrades on trial-end because we set `plan_source='admin_grant'` and
// (optionally) a null trial cutoff.

import type { Clinic } from "@/lib/db/schema";

export type PlanTier = "free" | "growth" | "pro";

// Numeric rank so `assertPlan(clinic, "growth")` accepts growth OR pro.
const RANK: Record<PlanTier, number> = { free: 0, growth: 1, pro: 2 };

function coerce(raw: string | null | undefined): PlanTier {
  if (raw === "growth" || raw === "pro") return raw;
  return "free";
}

// Trial takes precedence — an unexpired trial always resolves to Pro.
export function effectivePlan(clinic: Pick<Clinic, "plan" | "planTrialEndsAt">): PlanTier {
  const trialEnd = clinic.planTrialEndsAt;
  if (trialEnd && trialEnd.getTime() > Date.now()) return "pro";
  return coerce(clinic.plan);
}

// True when the resolver is running because of an active trial. Callers
// use this to render "Trial: 47 days left" style banners.
export function isOnTrial(clinic: Pick<Clinic, "planTrialEndsAt">): boolean {
  const t = clinic.planTrialEndsAt;
  return !!(t && t.getTime() > Date.now());
}

export function trialDaysLeft(clinic: Pick<Clinic, "planTrialEndsAt">): number {
  const t = clinic.planTrialEndsAt;
  if (!t) return 0;
  const ms = t.getTime() - Date.now();
  return ms > 0 ? Math.ceil(ms / 86_400_000) : 0;
}

// True when the effective plan is >= the required tier.
export function hasPlan(
  clinic: Pick<Clinic, "plan" | "planTrialEndsAt">,
  required: PlanTier,
): boolean {
  return RANK[effectivePlan(clinic)] >= RANK[required];
}

// Throwing gate for server actions / route handlers. The caller catches
// PlanRequiredError to render a "Upgrade to Growth to use this" nudge
// instead of a generic 500.
export class PlanRequiredError extends Error {
  readonly required: PlanTier;
  readonly current: PlanTier;
  constructor(required: PlanTier, current: PlanTier) {
    super(`This feature requires the ${required} plan (currently on ${current}).`);
    this.name = "PlanRequiredError";
    this.required = required;
    this.current = current;
  }
}

export function assertPlan(
  clinic: Pick<Clinic, "plan" | "planTrialEndsAt">,
  required: PlanTier,
): void {
  if (!hasPlan(clinic, required)) {
    throw new PlanRequiredError(required, effectivePlan(clinic));
  }
}

// Per-tier monthly completed-booking quota. Used by the quota-enforcement
// path in Batch 3. Pro is uncapped.
export const MONTHLY_QUOTA: Record<PlanTier, number | null> = {
  free: 100,
  growth: 500,
  pro: null,
};

// Per-tier staff seats. Pro is uncapped. Free is single-provider; Growth
// covers a small team.
export const STAFF_SEATS: Record<PlanTier, number | null> = {
  free: 1,
  growth: 3,
  pro: null,
};
