import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: process.env.NODE_ENV === "production" ? ".env.production" : ".env.development.local" });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is missing");
const sql = neon(databaseUrl);

const statements = [
  `CREATE TABLE IF NOT EXISTS "trade_drafts" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL, "date" date NOT NULL, "data" jsonb NOT NULL, "created_at" timestamptz DEFAULT now() NOT NULL, "updated_at" timestamptz DEFAULT now() NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS "trade_drafts_date_idx" ON "trade_drafts" ("date")`,
  `CREATE TABLE IF NOT EXISTS "setup_types" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL, "name" text NOT NULL, "rules" jsonb DEFAULT '[]'::jsonb NOT NULL, "avoid_rules" jsonb DEFAULT '[]'::jsonb NOT NULL, "created_at" timestamptz DEFAULT now() NOT NULL, "updated_at" timestamptz DEFAULT now() NOT NULL)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "setup_types_name_idx" ON "setup_types" ("name")`,
  `DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'trade_setup') THEN ALTER TABLE "trades" ALTER COLUMN "setup" TYPE text USING "setup"::text; DROP TYPE "trade_setup"; END IF; END $$`,
  `ALTER TABLE "setup_types" ADD COLUMN IF NOT EXISTS "rules" jsonb DEFAULT '[]'::jsonb NOT NULL`,
  `ALTER TABLE "setup_types" ADD COLUMN IF NOT EXISTS "avoid_rules" jsonb DEFAULT '[]'::jsonb NOT NULL`,
  `ALTER TABLE "trades" ADD COLUMN IF NOT EXISTS "setup_grade" text`,
  `ALTER TABLE "trades" ADD COLUMN IF NOT EXISTS "setup_checklist" jsonb DEFAULT '[]'::jsonb NOT NULL`,
  `ALTER TABLE "trades" ADD COLUMN IF NOT EXISTS "setup_avoid_checklist" jsonb DEFAULT '[]'::jsonb NOT NULL`,
  `ALTER TABLE "trades" ADD COLUMN IF NOT EXISTS "psychology_ready" boolean DEFAULT false NOT NULL`,
  `ALTER TABLE "trades" ADD COLUMN IF NOT EXISTS "psychology_answer" text DEFAULT '' NOT NULL`,
  `ALTER TABLE "trades" ADD COLUMN IF NOT EXISTS "profit_booked" numeric(14, 2) DEFAULT '0' NOT NULL`,
  `ALTER TABLE "trades" ADD COLUMN IF NOT EXISTS "break_even_after_profit" boolean DEFAULT false NOT NULL`,
  `INSERT INTO "setup_types" ("name", "rules", "avoid_rules") VALUES ('Liquidity Sweep', '["Liquidity is swept", "Displacement confirms direction", "Entry has clear invalidation"]', '["Chasing an extended move", "Stop loss is unclear"]'), ('Break & Retest', '["Break is confirmed", "Retest holds", "Risk is defined"]', '["Retest fails", "Entry is too far from invalidation"]'), ('Reversal', '["Exhaustion is visible", "Reversal confirmation is present", "Risk is defined"]', '["No reversal confirmation", "Entering against strong momentum"]'), ('Continuation', '["Trend is clear", "Pullback is controlled", "Risk is defined"]', '[]'), ('Other', '[]', '[]') ON CONFLICT ("name") DO NOTHING`,
];

async function main() {
  for (const statement of statements) await sql.query(statement);
  console.log(`Applied ${statements.length} database compatibility statements.`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
