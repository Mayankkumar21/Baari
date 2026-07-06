-- One-shot migration: fold sub-tokens into partySize, drop the table,
-- and add the new slot-uniqueness index in one atomic transaction.
--
-- Order: run AFTER the new code is deployed. The new code no longer
-- references sub_tokens, so it's fine for the table to sit around dead
-- for a few minutes between deploy and this script. Running BEFORE the
-- code deploy would break the still-running old app.
--
-- Idempotent — safe to run twice. Every step guards on IF EXISTS or
-- to_regclass so the second run is a no-op. Wrapped in a transaction
-- so a partial failure leaves the old state intact.
--
--   psql "$DATABASE_URL" -f scripts/drop-sub-tokens.sql

BEGIN;

-- Backfill: for each booking that has at least one pending sub-token
-- (booked / checked_in / in_consult), bump party_size by the count of
-- those tokens so the doctor still knows how many people to see. Skip
-- done / cancelled / no_show sub-tokens — those were already handled
-- and shouldn't inflate the count. Guarded by to_regclass so a rerun
-- (after the table is gone) is a no-op instead of an error.
DO $$
BEGIN
  IF to_regclass('public.sub_tokens') IS NOT NULL THEN
    UPDATE bookings b
       SET party_size = b.party_size + s.n
      FROM (
        SELECT booking_id, COUNT(*)::int AS n
          FROM sub_tokens
         WHERE status IN ('booked', 'checked_in', 'in_consult')
         GROUP BY booking_id
      ) s
     WHERE s.booking_id = b.id;
  END IF;
END $$;

-- Notifications had an FK to sub_tokens. Drop the column so we can
-- drop the table without dangling constraints. We're losing the
-- sub_token_id linkage but keeping the notification rows themselves.
ALTER TABLE notifications DROP COLUMN IF EXISTS sub_token_id;

-- Drop the table + enum. IF EXISTS makes this idempotent.
DROP TABLE IF EXISTS sub_tokens;
DROP TYPE  IF EXISTS sub_token_status;

-- Partial unique index that guards against double-booking a slot at
-- the DB level. Added here so users don't have to also run
-- drizzle-kit push separately for this deploy. IF NOT EXISTS makes
-- it idempotent.
CREATE UNIQUE INDEX IF NOT EXISTS uq_bookings_clinic_slot_live
    ON bookings (clinic_id, slot_time)
 WHERE status IN ('booked', 'checked_in', 'in_consult');

COMMIT;
