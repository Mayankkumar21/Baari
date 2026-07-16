-- Payment intent capture. One row per "I want to upgrade" click.
-- Replaces the checkout flow while Stripe / BSP integration is
-- deferred. Additive, IF NOT EXISTS guarded, safe to re-run.

BEGIN;

CREATE TABLE IF NOT EXISTS plan_interest (
  id               serial PRIMARY KEY,
  clinic_id        integer NOT NULL REFERENCES clinics(id),
  user_id          integer NOT NULL REFERENCES users(id),
  desired_plan     varchar(20) NOT NULL,
  region           varchar(10),
  contact_email    varchar(254),
  contact_mobile   varchar(15),
  note             varchar(500),
  contacted_at     timestamptz,
  converted_at     timestamptz,
  created_at       timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS plan_interest_clinic_idx  ON plan_interest (clinic_id);
CREATE INDEX IF NOT EXISTS plan_interest_created_idx ON plan_interest (created_at);

COMMIT;
