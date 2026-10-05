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
  `CREATE TABLE IF NOT EXISTS "users" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL, "name" text NOT NULL, "email" text NOT NULL, "password_hash" text NOT NULL, "created_at" timestamptz DEFAULT now() NOT NULL, "updated_at" timestamptz DEFAULT now() NOT NULL)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "users_email_idx" ON "users" ("email")`,
  `CREATE TABLE IF NOT EXISTS "password_reset_tokens" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL, "user_id" uuid NOT NULL, "token_hash" text NOT NULL, "expires_at" timestamptz NOT NULL, "used_at" timestamptz, "created_at" timestamptz DEFAULT now() NOT NULL)`,
  `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'password_reset_tokens_user_id_users_id_fk') THEN ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE; END IF; END $$`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "password_reset_tokens_hash_idx" ON "password_reset_tokens" ("token_hash")`,
  `CREATE INDEX IF NOT EXISTS "password_reset_tokens_user_idx" ON "password_reset_tokens" ("user_id")`,
  `ALTER TABLE "setup_types" ADD COLUMN IF NOT EXISTS "user_id" uuid`,
  `ALTER TABLE "trade_drafts" ADD COLUMN IF NOT EXISTS "user_id" uuid`,
  `ALTER TABLE "trades" ADD COLUMN IF NOT EXISTS "user_id" uuid`,
  `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'setup_types_user_id_users_id_fk') THEN ALTER TABLE "setup_types" ADD CONSTRAINT "setup_types_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE; END IF; END $$`,
  `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trade_drafts_user_id_users_id_fk') THEN ALTER TABLE "trade_drafts" ADD CONSTRAINT "trade_drafts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE; END IF; END $$`,
  `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trades_user_id_users_id_fk') THEN ALTER TABLE "trades" ADD CONSTRAINT "trades_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE; END IF; END $$`,
  `DROP INDEX IF EXISTS "setup_types_name_idx"`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "setup_types_user_name_idx" ON "setup_types" ("user_id", "name")`,
  `DROP INDEX IF EXISTS "trade_drafts_date_idx"`,
  `CREATE INDEX IF NOT EXISTS "trade_drafts_user_date_idx" ON "trade_drafts" ("user_id", "date")`,
  `CREATE INDEX IF NOT EXISTS "trades_user_date_idx" ON "trades" ("user_id", "date")`,
  `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM "trades" WHERE "user_id" IS NULL) THEN ALTER TABLE "trades" ALTER COLUMN "user_id" SET NOT NULL; END IF; END $$`,
  `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM "trade_drafts" WHERE "user_id" IS NULL) THEN ALTER TABLE "trade_drafts" ALTER COLUMN "user_id" SET NOT NULL; END IF; END $$`,
  `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM "setup_types" WHERE "user_id" IS NULL) THEN ALTER TABLE "setup_types" ALTER COLUMN "user_id" SET NOT NULL; END IF; END $$`,
];

async function main() {
  for (const statement of statements) await sql.query(statement);
  console.log(`Applied ${statements.length} database compatibility statements.`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
