CREATE TABLE IF NOT EXISTS "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "email" text NOT NULL,
  "password_hash" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_idx" ON "users" USING btree ("email");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "token_hash" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "used_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'password_reset_tokens_user_id_users_id_fk') THEN ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action; END IF; END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "password_reset_tokens_hash_idx" ON "password_reset_tokens" USING btree ("token_hash");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "password_reset_tokens_user_idx" ON "password_reset_tokens" USING btree ("user_id");
--> statement-breakpoint
ALTER TABLE "setup_types" ADD COLUMN IF NOT EXISTS "user_id" uuid;
--> statement-breakpoint
ALTER TABLE "trade_drafts" ADD COLUMN IF NOT EXISTS "user_id" uuid;
--> statement-breakpoint
ALTER TABLE "trades" ADD COLUMN IF NOT EXISTS "user_id" uuid;
--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'setup_types_user_id_users_id_fk') THEN ALTER TABLE "setup_types" ADD CONSTRAINT "setup_types_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action; END IF; END $$;
--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trade_drafts_user_id_users_id_fk') THEN ALTER TABLE "trade_drafts" ADD CONSTRAINT "trade_drafts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action; END IF; END $$;
--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trades_user_id_users_id_fk') THEN ALTER TABLE "trades" ADD CONSTRAINT "trades_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action; END IF; END $$;
--> statement-breakpoint
DROP INDEX IF EXISTS "setup_types_name_idx";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "setup_types_user_name_idx" ON "setup_types" USING btree ("user_id", "name");
--> statement-breakpoint
DROP INDEX IF EXISTS "trade_drafts_date_idx";
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trade_drafts_user_date_idx" ON "trade_drafts" USING btree ("user_id", "date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trades_user_date_idx" ON "trades" USING btree ("user_id", "date");
--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM "trades" WHERE "user_id" IS NULL) THEN ALTER TABLE "trades" ALTER COLUMN "user_id" SET NOT NULL; END IF; END $$;
--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM "trade_drafts" WHERE "user_id" IS NULL) THEN ALTER TABLE "trade_drafts" ALTER COLUMN "user_id" SET NOT NULL; END IF; END $$;
--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM "setup_types" WHERE "user_id" IS NULL) THEN ALTER TABLE "setup_types" ALTER COLUMN "user_id" SET NOT NULL; END IF; END $$;
