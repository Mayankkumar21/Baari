-- Batch 1 schema push: billing-plan columns on clinics.
--
-- Additive only, wrapped in a transaction, IF NOT EXISTS guarded so it
-- is safe to re-run. Sibling backfill: give every existing clinic 60
-- days of trial from run-time (they'd otherwise resolve to Free
-- immediately once the plan resolver ships).
--
-- Ordering: run BEFORE the plan-resolver code deploys — the resolver
-- reads these columns and will crash if they don't exist yet. Fine to
-- run any time before that point.

BEGIN;

ALTER TABLE clinics ADD COLUMN IF NOT EXISTS plan               varchar(20)   NOT NULL DEFAULT 'free';
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS plan_trial_ends_at timestamptz;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS plan_source        varchar(20)   NOT NULL DEFAULT 'trial';
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS plan_granted_by    integer;

-- Backfill: every existing workspace gets 60 days of Pro from now.
-- Only touches rows where the trial cutoff is still null — a re-run
-- won't reset an already-set expiry.
UPDATE clinics
   SET plan_trial_ends_at = NOW() + INTERVAL '60 days'
 WHERE plan_trial_ends_at IS NULL;

COMMIT;
