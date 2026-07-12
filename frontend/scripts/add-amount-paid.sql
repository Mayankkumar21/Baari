-- Add optional amount tracking on completed bookings.
--
-- Nullable — receptionist types it in the "Mark done" flow only if
-- the clinic cares about revenue tracking. Reports SUM only non-null
-- rows so clinics that never type an amount get zero, not garbage.
--
-- Idempotent — IF NOT EXISTS on the column add. Safe to rerun.
--
--   psql "$DATABASE_URL" -f scripts/add-amount-paid.sql

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS amount_paid_inr integer;

-- Optional partial index — cheap, and speeds up revenue rollups that
-- only touch bookings with a recorded amount. Skip WHERE with NULLS
-- FIRST as the more general form; partial keeps index size small
-- while covering the query pattern reports.ts uses.
CREATE INDEX IF NOT EXISTS bookings_amount_paid_idx
    ON bookings (clinic_id, date)
 WHERE amount_paid_inr IS NOT NULL;
