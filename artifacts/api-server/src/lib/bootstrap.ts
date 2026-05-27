import { db, pool } from "./db";
import { usersTable, sportConfigsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "./auth";
import { DEFAULT_SPORT_CONFIGS } from "./sportDefaults";
import { logger } from "./logger";
// @ts-expect-error - bundled by esbuild via the .sql text loader
import migrationSql from "../../../../lib/db/drizzle/0000_melted_shatterstar.sql";

const IGNORABLE = /already exists|duplicate/i;

export async function runMigrations(): Promise<void> {
  const sql: string = migrationSql as string;
  const statements = sql
    .split(/-->\s*statement-breakpoint/)
    .map((s) => s.trim())
    .filter(Boolean);

  let applied = 0;
  let skipped = 0;
  for (const stmt of statements) {
    try {
      await pool.query(stmt);
      applied += 1;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (IGNORABLE.test(msg)) {
        skipped += 1;
      } else {
        logger.error({ err: msg, stmt: stmt.slice(0, 120) }, "Migration statement failed");
        throw err;
      }
    }
  }
  logger.info({ applied, skipped, total: statements.length }, "Schema migrations completed");
}

export async function ensureSuperadmin(): Promise<void> {
  const existing = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.role, "superadmin"))
    .limit(1);

  if (existing.length) {
    logger.info("Superadmin already present");
    return;
  }

  const password = await hashPassword("Bhullar_01");
  await db.insert(usersTable).values({
    name: "Bhullar Sir",
    username: "bhullar01",
    password,
    role: "superadmin",
    schoolId: null,
    status: "approved",
    isOwner: true,
  });
  logger.info("Seeded default superadmin (bhullar01 / Bhullar_01)");
}

export async function ensureSportConfigs(): Promise<void> {
  const existing = await db.select({ id: sportConfigsTable.id }).from(sportConfigsTable).limit(1);
  if (existing.length) return;
  const entries = Object.entries(DEFAULT_SPORT_CONFIGS);
  for (const [sport, def] of entries) {
    await db
      .insert(sportConfigsTable)
      .values({ sportName: sport, icon: def.icon, fieldsJson: def.fields })
      .onConflictDoNothing();
  }
  logger.info({ count: entries.length }, "Seeded default sport configs");
}

export async function ensureSchemaAdditions(): Promise<void> {
  const stmts = [
    `ALTER TABLE schools ADD COLUMN IF NOT EXISTS whatsapp_number text DEFAULT '' NOT NULL`,
    `ALTER TABLE schools ADD COLUMN IF NOT EXISTS owner_phone text DEFAULT '' NOT NULL`,
    `ALTER TABLE schools ADD COLUMN IF NOT EXISTS owner_whatsapp text DEFAULT '' NOT NULL`,
    `ALTER TABLE schools ADD COLUMN IF NOT EXISTS owner_email text DEFAULT '' NOT NULL`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS whatsapp_number text DEFAULT '' NOT NULL`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth date`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS gender text DEFAULT '' NOT NULL`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS section text DEFAULT '' NOT NULL`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS roll_number text DEFAULT '' NOT NULL`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS designation text DEFAULT '' NOT NULL`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS player_code text`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS coach_code text`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS parent_name text DEFAULT '' NOT NULL`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS parent_whatsapp text DEFAULT '' NOT NULL`,
    `CREATE UNIQUE INDEX IF NOT EXISTS users_player_code_unique ON users (player_code) WHERE player_code IS NOT NULL`,
    `CREATE UNIQUE INDEX IF NOT EXISTS users_coach_code_unique ON users (coach_code) WHERE coach_code IS NOT NULL`,
    `CREATE TABLE IF NOT EXISTS pricing_config (
       id serial PRIMARY KEY,
       base_fee integer NOT NULL DEFAULT 999,
       per_player_fee integer NOT NULL DEFAULT 5,
       mod_attendance integer NOT NULL DEFAULT 99,
       mod_performance integer NOT NULL DEFAULT 99,
       mod_analytics integer NOT NULL DEFAULT 149,
       mod_leaderboard integer NOT NULL DEFAULT 99,
       mod_calendar integer NOT NULL DEFAULT 99,
       mod_messaging integer NOT NULL DEFAULT 149,
       mod_photos integer NOT NULL DEFAULT 99,
       mod_notifications integer NOT NULL DEFAULT 49,
       mod_fees integer NOT NULL DEFAULT 99,
       mod_registration integer NOT NULL DEFAULT 49,
       currency text NOT NULL DEFAULT 'INR',
       grace_period_days integer NOT NULL DEFAULT 7,
       reminder_days_before integer NOT NULL DEFAULT 3,
       auto_suspend_after_days integer NOT NULL DEFAULT 15,
       updated_at timestamp DEFAULT now()
     )`,
    `INSERT INTO pricing_config (id) VALUES (1) ON CONFLICT DO NOTHING`,
    `ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS ai_enabled boolean NOT NULL DEFAULT true`,
    `ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS website_enabled boolean NOT NULL DEFAULT true`,
    `ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS custom_message text DEFAULT ''`,
    `ALTER TABLE pricing_config ADD COLUMN IF NOT EXISTS mod_ai integer NOT NULL DEFAULT 199`,
    `ALTER TABLE pricing_config ADD COLUMN IF NOT EXISTS mod_website integer NOT NULL DEFAULT 149`,
    `ALTER TABLE pricing_config ADD COLUMN IF NOT EXISTS per_sport_fee integer NOT NULL DEFAULT 29`,
    `ALTER TABLE pricing_config ADD COLUMN IF NOT EXISTS upi_id text DEFAULT ''`,
    `ALTER TABLE pricing_config ADD COLUMN IF NOT EXISTS qr_code_url text DEFAULT ''`,
    `ALTER TABLE pricing_config ADD COLUMN IF NOT EXISTS account1_bank_name text DEFAULT ''`,
    `ALTER TABLE pricing_config ADD COLUMN IF NOT EXISTS account1_account_number text DEFAULT ''`,
    `ALTER TABLE pricing_config ADD COLUMN IF NOT EXISTS account1_ifsc_code text DEFAULT ''`,
    `ALTER TABLE pricing_config ADD COLUMN IF NOT EXISTS account1_holder_name text DEFAULT ''`,
    `ALTER TABLE pricing_config ADD COLUMN IF NOT EXISTS account2_bank_name text DEFAULT ''`,
    `ALTER TABLE pricing_config ADD COLUMN IF NOT EXISTS account2_account_number text DEFAULT ''`,
    `ALTER TABLE pricing_config ADD COLUMN IF NOT EXISTS account2_ifsc_code text DEFAULT ''`,
    `ALTER TABLE pricing_config ADD COLUMN IF NOT EXISTS account2_holder_name text DEFAULT ''`,
    `CREATE TABLE IF NOT EXISTS subscriptions (
       id serial PRIMARY KEY,
       school_id integer NOT NULL UNIQUE REFERENCES schools(id) ON DELETE CASCADE,
       plan_name text NOT NULL DEFAULT 'Standard',
       billing_cycle_day integer NOT NULL DEFAULT 1,
       status text NOT NULL DEFAULT 'active',
       auto_bill boolean NOT NULL DEFAULT true,
       next_invoice_date date,
       last_invoiced_at timestamp,
       notes text DEFAULT '',
       created_at timestamp DEFAULT now(),
       updated_at timestamp DEFAULT now()
     )`,
    `CREATE TABLE IF NOT EXISTS invoices (
       id serial PRIMARY KEY,
       school_id integer NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
       invoice_number text NOT NULL,
       period_start date NOT NULL,
       period_end date NOT NULL,
       due_date date NOT NULL,
       line_items jsonb DEFAULT '[]'::jsonb,
       subtotal integer NOT NULL DEFAULT 0,
       total integer NOT NULL DEFAULT 0,
       currency text NOT NULL DEFAULT 'INR',
       status text NOT NULL DEFAULT 'pending',
       paid_at timestamp,
       paid_method text DEFAULT '',
       notes text DEFAULT '',
       created_at timestamp DEFAULT now()
     )`,
    `CREATE TABLE IF NOT EXISTS letters (
       id serial PRIMARY KEY,
       school_id integer REFERENCES schools(id) ON DELETE CASCADE,
       author_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       letter_type text NOT NULL DEFAULT 'custom',
       prompt text NOT NULL DEFAULT '',
       recipient text NOT NULL DEFAULT '',
       subject text NOT NULL DEFAULT '',
       body text NOT NULL,
       sender_name text NOT NULL DEFAULT '',
       sender_designation text NOT NULL DEFAULT '',
       created_at timestamp DEFAULT now()
     )`,
    `CREATE TABLE IF NOT EXISTS certificates (
       id serial PRIMARY KEY,
       school_id integer REFERENCES schools(id) ON DELETE CASCADE,
       author_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       player_id integer REFERENCES users(id) ON DELETE SET NULL,
       player_name text NOT NULL DEFAULT '',
       template text NOT NULL DEFAULT 'participation',
       event_name text NOT NULL DEFAULT '',
       score text NOT NULL DEFAULT '',
       sport text NOT NULL DEFAULT '',
       citation text NOT NULL,
       signatory_name text NOT NULL DEFAULT '',
       signatory_designation text NOT NULL DEFAULT '',
       created_at timestamp DEFAULT now()
     )`,
    `CREATE TABLE IF NOT EXISTS reminder_log (
       id serial PRIMARY KEY,
       invoice_id integer REFERENCES invoices(id) ON DELETE CASCADE,
       school_id integer NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
       channel text NOT NULL,
       recipient text DEFAULT '',
       subject text DEFAULT '',
       body text NOT NULL,
       status text NOT NULL DEFAULT 'sent',
       provider text DEFAULT 'stub',
       error text DEFAULT '',
       created_at timestamp DEFAULT now()
     )`,
    // ── New additions ──────────────────────────────────────────────
    `ALTER TYPE role ADD VALUE IF NOT EXISTS 'parent'`,
    `ALTER TABLE schools ADD COLUMN IF NOT EXISTS is_demo boolean DEFAULT false NOT NULL`,
    `ALTER TABLE schools ADD COLUMN IF NOT EXISTS demo_message text DEFAULT ''`,
    `CREATE TABLE IF NOT EXISTS parent_player_links (
       id serial PRIMARY KEY,
       parent_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       player_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       school_id integer NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
       created_at timestamp DEFAULT now(),
       UNIQUE(parent_id, player_id)
     )`,
  ];
  let added = 0;
  for (const s of stmts) {
    try {
      await pool.query(s);
      added += 1;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!IGNORABLE.test(msg)) {
        logger.error({ err: msg, stmt: s }, "Schema addition failed");
        throw err;
      }
    }
  }
  logger.info({ count: added }, "Schema additions ensured");
}

export async function bootstrap(): Promise<void> {
  await runMigrations();
  await ensureSchemaAdditions();
  await ensureSuperadmin();
  await ensureSportConfigs();
}
