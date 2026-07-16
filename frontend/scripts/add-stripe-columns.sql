-- Stripe subscription state columns on clinics.
-- Additive, IF NOT EXISTS guarded, safe to re-run.
-- Ordering: run BEFORE the Stripe code deploys — the checkout/webhook
-- routes read these columns and would crash if they don't exist yet.

BEGIN;

ALTER TABLE clinics ADD COLUMN IF NOT EXISTS stripe_customer_id       varchar(64);
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS stripe_subscription_id   varchar(64);
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS plan_current_period_end  timestamptz;

-- Partial unique index on customer_id — one Stripe Customer per clinic.
-- Nullable rows (clinics that never checked out) don't collide.
CREATE UNIQUE INDEX IF NOT EXISTS uq_clinics_stripe_customer
  ON clinics (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

COMMIT;
