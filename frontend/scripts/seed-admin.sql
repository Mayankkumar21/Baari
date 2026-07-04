-- Seed the "Baari HQ" workspace + admin owner accounts.
-- Idempotent: safe to re-run. Skips inserts that would collide.
--
-- Before running, replace <BCRYPT_HASH> below with a bcrypt hash of your
-- chosen admin password. Generate one with:
--
--   node -e 'require("bcryptjs").hash("your-strong-password", 10).then(console.log)'
--
-- (Run that from ./frontend so bcryptjs resolves.)
--
-- After running, log in at /login with either admin mobile + the password
-- you chose. /admin should appear in the header.

DO $$
DECLARE
  admin_clinic_id INT;
BEGIN
  -- Create the placeholder workspace if it doesn't exist. tenant_type
  -- "other" so it doesn't pollute the "clinic" default. Not publicly
  -- listed. Setup marked complete so requireSetup guards don't kick us
  -- to the setup wizard.
  SELECT id INTO admin_clinic_id
  FROM clinics
  WHERE name = 'Baari HQ'
  LIMIT 1;

  IF admin_clinic_id IS NULL THEN
    INSERT INTO clinics (
      name, tenant_type, slot_length_min, no_show_threshold_min,
      setup_complete, public_listing, accept_app_bookings
    )
    VALUES ('Baari HQ', 'other', 20, 45, true, false, false)
    RETURNING id INTO admin_clinic_id;
  END IF;

  -- Owner rows for each admin mobile. Password hash is a placeholder —
  -- replace <BCRYPT_HASH> once you've generated one. Same hash used for
  -- both accounts (change per-row if you want distinct passwords).
  INSERT INTO users (clinic_id, role, mobile, password_hash, name, email, active)
  VALUES
    (admin_clinic_id, 'doctor', '9893127527', '<BCRYPT_HASH>', 'Mayank', NULL, true),
    (admin_clinic_id, 'doctor', '9479273947', '<BCRYPT_HASH>', 'Admin 2', NULL, true)
  ON CONFLICT (clinic_id, mobile) DO NOTHING;
END $$;

-- Sanity check — after running, this should return 2 rows.
SELECT id, mobile, name, active FROM users WHERE mobile IN ('9893127527', '9479273947');
