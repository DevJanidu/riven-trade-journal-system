CREATE TYPE "public"."trade_direction" AS ENUM('Long', 'Short');--> statement-breakpoint
CREATE TYPE "public"."trade_emotion" AS ENUM('Calm', 'Confident', 'FOMO', 'Fear', 'Revenge', 'Impatient');--> statement-breakpoint
CREATE TYPE "public"."trade_result" AS ENUM('Win', 'Loss', 'Break Even');--> statement-breakpoint
CREATE TYPE "public"."trade_session" AS ENUM('Asia', 'London', 'New York');--> statement-breakpoint
CREATE TYPE "public"."trade_setup" AS ENUM('Liquidity Sweep', 'Break & Retest', 'Reversal', 'Continuation', 'Other');--> statement-breakpoint
CREATE TABLE "trades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"instrument" text DEFAULT 'XAUUSD' NOT NULL,
	"session" "trade_session" NOT NULL,
	"direction" "trade_direction" NOT NULL,
	"entry" numeric(12, 2) NOT NULL,
	"stop_loss" numeric(12, 2) NOT NULL,
	"take_profit" numeric(12, 2) NOT NULL,
	"risk_amount" numeric(12, 2) NOT NULL,
	"planned_rr" numeric(12, 4) NOT NULL,
	"actual_r" numeric(12, 4) NOT NULL,
	"profit_loss" numeric(14, 2) NOT NULL,
	"result" "trade_result" NOT NULL,
	"setup" "trade_setup" NOT NULL,
	"trading_view_url" text,
	"before_screenshot" text,
	"after_screenshot" text,
	"entry_reason" text DEFAULT '' NOT NULL,
	"went_well" text DEFAULT '' NOT NULL,
	"went_wrong" text DEFAULT '' NOT NULL,
	"improvement" text DEFAULT '' NOT NULL,
	"followed_rules" boolean NOT NULL,
	"emotion" "trade_emotion" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trades_xauusd_only" CHECK ("trades"."instrument" = 'XAUUSD'),
	CONSTRAINT "trades_entry_positive" CHECK ("trades"."entry" > 0),
	CONSTRAINT "trades_stop_loss_positive" CHECK ("trades"."stop_loss" > 0),
	CONSTRAINT "trades_take_profit_positive" CHECK ("trades"."take_profit" > 0),
	CONSTRAINT "trades_risk_amount_positive" CHECK ("trades"."risk_amount" > 0),
	CONSTRAINT "trades_planned_rr_nonnegative" CHECK ("trades"."planned_rr" >= 0)
);
--> statement-breakpoint
CREATE INDEX "trades_date_created_idx" ON "trades" USING btree ("date","created_at");--> statement-breakpoint
CREATE INDEX "trades_session_idx" ON "trades" USING btree ("session");--> statement-breakpoint
CREATE INDEX "trades_setup_idx" ON "trades" USING btree ("setup");--> statement-breakpoint
CREATE INDEX "trades_result_idx" ON "trades" USING btree ("result");--> statement-breakpoint
CREATE INDEX "trades_direction_idx" ON "trades" USING btree ("direction");