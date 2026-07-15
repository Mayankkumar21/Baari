-- Batch 3 schema push: bookings.category for category-revenue split.
-- Additive, nullable, safe to re-run.
BEGIN;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS category varchar(40);
COMMIT;
