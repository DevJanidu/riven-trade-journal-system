CREATE TABLE IF NOT EXISTS "setup_types" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "rules" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "avoid_rules" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "setup_types_name_idx" ON "setup_types" USING btree ("name");
ALTER TABLE "trades" ALTER COLUMN "setup" TYPE text USING "setup"::text;
DROP TYPE IF EXISTS "trade_setup";
INSERT INTO "setup_types" ("name", "rules") VALUES ('Liquidity Sweep', '["Liquidity is swept", "Displacement confirms direction", "Entry has clear invalidation"]'), ('Break & Retest', '["Break is confirmed", "Retest holds", "Risk is defined"]'), ('Reversal', '["Exhaustion is visible", "Reversal confirmation is present", "Risk is defined"]'), ('Continuation', '["Trend is clear", "Pullback is controlled", "Risk is defined"]'), ('Other', '[]') ON CONFLICT ("name") DO NOTHING;
