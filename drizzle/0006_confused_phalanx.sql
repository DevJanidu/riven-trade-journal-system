CREATE TABLE IF NOT EXISTS "gold_generation_locks" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"token" uuid NOT NULL,
	"locked_until" timestamp with time zone NOT NULL,
	"next_allowed_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "gold_weekly_analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"analysis_date" timestamp with time zone NOT NULL,
	"week_start" date NOT NULL,
	"week_end" date NOT NULL,
	"model" text NOT NULL,
	"prompt_version" text NOT NULL,
	"gold_price" numeric(16, 6),
	"fundamental_bias" text NOT NULL,
	"confidence" integer NOT NULL,
	"bullish_probability" integer NOT NULL,
	"bearish_probability" integer NOT NULL,
	"range_probability" integer NOT NULL,
	"summary" text NOT NULL,
	"analysis" jsonb NOT NULL,
	"data_snapshot" jsonb NOT NULL,
	"technical_context" jsonb NOT NULL,
	"technical_alignment" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gold_analysis_confidence_range" CHECK ("gold_weekly_analyses"."confidence" BETWEEN 0 AND 100),
	CONSTRAINT "gold_analysis_probability_range" CHECK ("gold_weekly_analyses"."bullish_probability" BETWEEN 0 AND 100 AND "gold_weekly_analyses"."bearish_probability" BETWEEN 0 AND 100 AND "gold_weekly_analyses"."range_probability" BETWEEN 0 AND 100),
	CONSTRAINT "gold_analysis_probability_total" CHECK ("gold_weekly_analyses"."bullish_probability" + "gold_weekly_analyses"."bearish_probability" + "gold_weekly_analyses"."range_probability" = 100),
	CONSTRAINT "gold_analysis_bias_valid" CHECK ("gold_weekly_analyses"."fundamental_bias" IN ('strongly_bullish','moderately_bullish','neutral','moderately_bearish','strongly_bearish'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "market_data_cache" (
	"key" text PRIMARY KEY NOT NULL,
	"payload" jsonb,
	"expires_at" timestamp with time zone NOT NULL,
	"lock_token" uuid NOT NULL,
	"locked_until" timestamp with time zone NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gold_generation_locks_user_id_users_id_fk') THEN ALTER TABLE "gold_generation_locks" ADD CONSTRAINT "gold_generation_locks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action; END IF; END $$;
--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gold_weekly_analyses_user_id_users_id_fk') THEN ALTER TABLE "gold_weekly_analyses" ADD CONSTRAINT "gold_weekly_analyses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action; END IF; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gold_analyses_user_created_idx" ON "gold_weekly_analyses" USING btree ("user_id","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gold_analyses_user_week_idx" ON "gold_weekly_analyses" USING btree ("user_id","week_start");
