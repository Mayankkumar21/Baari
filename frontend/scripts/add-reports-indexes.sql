-- Composite indexes for the Growth-tier reports queries.
-- Silent-churn, new-vs-returning, LTV, cohort retention all
-- GROUP BY patient_id and aggregate on completed_at within a clinic.
-- Without these, each pageview does a sequential scan of bookings
-- once a workspace crosses ~1k rows.
--
-- IF NOT EXISTS guarded, safe to re-run. Idempotent CONCURRENTLY
-- variants would be nicer for a live prod DB but psql -f can't run
-- CREATE INDEX CONCURRENTLY inside a transaction; sticking with the
-- simple form since we're at pilot scale.

BEGIN;

CREATE INDEX IF NOT EXISTS bookings_clinic_patient_idx
  ON bookings (clinic_id, patient_id);

CREATE INDEX IF NOT EXISTS bookings_clinic_completed_idx
  ON bookings (clinic_id, completed_at);

COMMIT;
