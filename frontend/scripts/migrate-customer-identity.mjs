#!/usr/bin/env node
// One-off migration for the customer-identity tightening:
// 1. Drop the old non-unique mobile index
// 2. Add patients.customer_id (nullable FK)
// 3. Add customers.mobile_changed_at (nullable timestamp)
// 4. Create partial unique index on customers(mobile) WHERE deleted_at IS NULL
// 5. Backfill patients.customer_id where the mobile matches an active customer
//
// Idempotent — safe to re-run. Uses postgres-js directly because
// drizzle-kit push is interactive and prefers a TTY.

import "dotenv/config";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required.");
const sql = postgres(url, { ssl: "require", prepare: false, max: 1 });

async function run() {
  console.log("→ Dropping old mobile index (if exists)…");
  await sql`DROP INDEX IF EXISTS idx_customers_mobile`;

  console.log("→ Adding patients.customer_id…");
  await sql`ALTER TABLE patients ADD COLUMN IF NOT EXISTS customer_id integer`;

  console.log("→ Adding customers.mobile_changed_at…");
  await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS mobile_changed_at timestamp with time zone`;

  console.log("→ Adding patients → customers FK (if missing)…");
  await sql.unsafe(`
    DO $$ BEGIN
      ALTER TABLE patients
        ADD CONSTRAINT patients_customer_id_customers_id_fk
        FOREIGN KEY (customer_id) REFERENCES public.customers(id);
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);

  console.log("→ Index patients(customer_id)…");
  await sql`CREATE INDEX IF NOT EXISTS patients_customer_idx ON patients USING btree (customer_id)`;

  console.log("→ Partial unique index customers(mobile) WHERE deleted_at IS NULL…");
  // If existing rows have duplicate mobiles, this fails — abort with a
  // hint so the operator can deduplicate manually.
  try {
    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_customers_mobile_active
        ON customers USING btree (mobile)
        WHERE deleted_at IS NULL
    `;
  } catch (e) {
    console.error("✖ Unique index creation failed — likely existing duplicate mobiles.");
    console.error("  Run: SELECT mobile, count(*) FROM customers WHERE deleted_at IS NULL GROUP BY mobile HAVING count(*) > 1;");
    throw e;
  }

  console.log("→ Backfilling patients.customer_id by matching mobile…");
  const r = await sql`
    UPDATE patients p
    SET customer_id = c.id
    FROM customers c
    WHERE p.mobile = c.mobile
      AND p.customer_id IS NULL
      AND c.deleted_at IS NULL
  `;
  console.log(`  ${r.count} patient row(s) linked to a customer.`);

  console.log("✓ Migration complete.");
}

run()
  .then(() => sql.end())
  .catch(async (e) => {
    console.error(e);
    await sql.end();
    process.exit(1);
  });
