-- Migrate legacy 10-digit Indian mobile numbers to E.164 format.
--
-- Before this change, Baari stored Indian mobiles as bare 10-digit
-- strings ("9893127527"). Now we accept international numbers and
-- store everything as E.164 with a leading "+" ("+919893127527").
--
-- This one-shot script prepends "+91" to every mobile that:
--   - is NOT already E.164 (no "+" prefix), AND
--   - matches the Indian mobile pattern ([6-9]\d{9})
--
-- Anything else is left alone so we don't accidentally corrupt a row
-- that's already been migrated (safe to rerun) or a numeric string
-- we can't interpret.
--
-- Tables touched: users, customers, patients, bookings.guest_mobile,
-- password_resets (email-related, no mobile), email_verifications
-- (same). booking_requests uses a mobile in its trigger flow — check
-- that column exists before touching it.
--
--   psql "$DATABASE_URL" -f scripts/migrate-mobile-e164.sql

BEGIN;

-- users.mobile
UPDATE users
   SET mobile = '+91' || mobile
 WHERE mobile IS NOT NULL
   AND mobile NOT LIKE '+%'
   AND mobile ~ '^[6-9][0-9]{9}$';

-- customers.mobile
UPDATE customers
   SET mobile = '+91' || mobile
 WHERE mobile IS NOT NULL
   AND mobile NOT LIKE '+%'
   AND mobile ~ '^[6-9][0-9]{9}$';

-- patients.mobile — the largest table by row count, so filter tight
UPDATE patients
   SET mobile = '+91' || mobile
 WHERE mobile IS NOT NULL
   AND mobile NOT LIKE '+%'
   AND mobile ~ '^[6-9][0-9]{9}$';

-- bookings.guest_mobile — third-party bookings ("book for grandma")
UPDATE bookings
   SET guest_mobile = '+91' || guest_mobile
 WHERE guest_mobile IS NOT NULL
   AND guest_mobile NOT LIKE '+%'
   AND guest_mobile ~ '^[6-9][0-9]{9}$';

-- booking_requests.mobile — the missed-call flow's target
UPDATE booking_requests
   SET mobile = '+91' || mobile
 WHERE mobile IS NOT NULL
   AND mobile NOT LIKE '+%'
   AND mobile ~ '^[6-9][0-9]{9}$';

COMMIT;

-- Verify: rows that still don't start with "+" AFTER this migration
-- are either NULL (legit) or malformed (need a look). This SELECT
-- should return an empty set on a clean migration.
--
--   SELECT 'users' AS tbl, id, mobile FROM users WHERE mobile IS NOT NULL AND mobile NOT LIKE '+%'
--   UNION ALL
--   SELECT 'customers', id, mobile FROM customers WHERE mobile IS NOT NULL AND mobile NOT LIKE '+%'
--   UNION ALL
--   SELECT 'patients', id, mobile FROM patients WHERE mobile IS NOT NULL AND mobile NOT LIKE '+%';
