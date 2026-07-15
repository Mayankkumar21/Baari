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

// Per-tier monthly booking quota. Counts every non-cancelled booking
// created in the current calendar month, so an owner can't skirt the
// cap by never marking anything done. Pro is uncapped.
export const MONTHLY_QUOTA: Record<PlanTier, number | null> = {
  free: 100,
  growth: 500,
  pro: null,
};

// Threshold at which the UI shows a "80% used" banner (0..1).
export const QUOTA_WARN_AT = 0.8;

export type QuotaState = {
  plan: PlanTier;
  used: number;
  cap: number | null;
  // Convenience — computed at the same site for the banner + gate.
  isOverCap: boolean;
  isNearCap: boolean;
  monthLabel: string; // "July 2026"
};

// Count non-cancelled bookings created in the current month. Kept as a
// separate function from the resolver so the caller can await it once
// and reuse the number for both the gate and the banner.
export async function loadQuotaState(
  clinic: Pick<Clinic, "plan" | "planTrialEndsAt">,
  clinicId: number,
): Promise<QuotaState> {
  // Deferred imports to keep this module cycle-free (lib/plans.ts is
  // used by both server actions and route handlers, and importing
  // drizzle at the top would pull server-only code into any caller
  // that transitively imports plans).
  const { db, schema } = await import("@/lib/db/client");
  const { and, count, eq, gte, lt, ne } = await import("drizzle-orm");

  const plan = effectivePlan(clinic);
  const cap = MONTHLY_QUOTA[plan];

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  const [row] = await db
    .select({ n: count() })
    .from(schema.bookings)
    .where(
      and(
        eq(schema.bookings.clinicId, clinicId),
        ne(schema.bookings.status, "cancelled"),
        gte(schema.bookings.createdAt, monthStart),
        lt(schema.bookings.createdAt, monthEnd),
      ),
    );
  const used = Number(row?.n ?? 0);

  return {
    plan,
    used,
    cap,
    isOverCap: cap !== null && used >= cap,
    isNearCap: cap !== null && used >= Math.floor(cap * QUOTA_WARN_AT),
    monthLabel: monthStart.toLocaleString("en-US", { month: "long", year: "numeric" }),
  };
}

// Throwing gate for the four booking-create paths. Cheaper than
// PlanRequiredError because it's the SAME condition on the same table
// — cache the QuotaState in the caller if you need to check twice.
export class QuotaExceededError extends Error {
  readonly used: number;
  readonly cap: number;
  readonly plan: PlanTier;
  constructor(state: QuotaState & { cap: number }) {
    super(
      `Monthly booking cap reached (${state.used}/${state.cap} on the ${state.plan} plan). Upgrade to accept more this month.`,
    );
    this.name = "QuotaExceededError";
    this.used = state.used;
    this.cap = state.cap;
    this.plan = state.plan;
  }
}

export async function assertMonthlyQuota(
  clinic: Pick<Clinic, "plan" | "planTrialEndsAt">,
  clinicId: number,
): Promise<void> {
  const state = await loadQuotaState(clinic, clinicId);
  if (state.cap !== null && state.isOverCap) {
    throw new QuotaExceededError({ ...state, cap: state.cap });
  }
}

// Per-tier staff seats. Pro is uncapped. Free is single-provider; Growth
// covers a small team.
export const STAFF_SEATS: Record<PlanTier, number | null> = {
  free: 1,
  growth: 3,
  pro: null,
};
