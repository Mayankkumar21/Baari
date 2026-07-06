-- One-shot migration: fold sub-tokens into partySize, then drop the table.
--
-- Run BEFORE deploying the code change, so the app doesn't try to select
-- from a table it no longer knows about (or fail on FKs when doing it in
-- the other order).
--
-- Idempotent — safe to run twice. Wraps in a transaction so if anything
-- fails the old state stays.
--
--   psql "$DATABASE_URL" -f scripts/drop-sub-tokens.sql

BEGIN;

-- Backfill: for each booking that has at least one pending sub-token
-- (booked / checked_in / in_consult), bump party_size by the count of
-- those tokens so the doctor still knows how many people to see. Skip
-- done / cancelled / no_show sub-tokens — those were already handled
-- and shouldn't inflate the count.
UPDATE bookings b
   SET party_size = b.party_size + s.n
  FROM (
    SELECT booking_id, COUNT(*)::int AS n
      FROM sub_tokens
     WHERE status IN ('booked', 'checked_in', 'in_consult')
     GROUP BY booking_id
  ) s
 WHERE s.booking_id = b.id;

-- The notifications table has an FK to sub_tokens. Null the column
-- before the drop so we don't lose the notification history.
ALTER TABLE notifications DROP COLUMN IF EXISTS sub_token_id;

-- Drop the table + enum. IF EXISTS makes this idempotent.
DROP TABLE IF EXISTS sub_tokens;
DROP TYPE  IF EXISTS sub_token_status;

COMMIT;
