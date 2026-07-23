-- Bump 8 mobile/phone columns from varchar(15) → varchar(20).
--
-- Root cause: E164_RE in lib/auth.ts accepts "+[1-9]\d{7,14}" (up to
-- 16 chars total). The columns were sized for +91XXXXXXXXXX (13 chars)
-- from the India-only era. Now that non-Indian E.164 numbers flow
-- through, the INSERT throws Postgres 22001 "value too long for type
-- character varying(15)" — currently blocking bookings on prod.
--
-- Length increases on varchar are in-place in Postgres (no rewrite,
-- brief ACCESS EXCLUSIVE lock). Safe on live traffic.

ALTER TABLE "clinics"          ALTER COLUMN "mobile"         TYPE varchar(20);
ALTER TABLE "clinics"          ALTER COLUMN "phone"          TYPE varchar(20);
ALTER TABLE "users"            ALTER COLUMN "mobile"         TYPE varchar(20);
ALTER TABLE "patients"         ALTER COLUMN "mobile"         TYPE varchar(20);
ALTER TABLE "bookings"         ALTER COLUMN "guest_mobile"   TYPE varchar(20);
ALTER TABLE "plan_interest"    ALTER COLUMN "contact_mobile" TYPE varchar(20);
ALTER TABLE "customers"        ALTER COLUMN "mobile"         TYPE varchar(20);
ALTER TABLE "booking_requests" ALTER COLUMN "mobile"         TYPE varchar(20);

-- Verify:
-- SELECT table_name, column_name, character_maximum_length
-- FROM information_schema.columns
-- WHERE column_name IN ('mobile','phone','guest_mobile','contact_mobile')
-- ORDER BY table_name, column_name;
