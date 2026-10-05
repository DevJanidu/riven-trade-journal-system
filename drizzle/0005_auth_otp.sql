CREATE TABLE IF NOT EXISTS "auth_challenges" (
  "id" uuid PRIMARY KEY NOT NULL,
  "email" text NOT NULL,
  "purpose" text NOT NULL,
  "code_hash" text NOT NULL,
  "payload" jsonb NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "delivered" boolean DEFAULT false NOT NULL,
  "verified_at" timestamptz,
  "expires_at" timestamptz NOT NULL,
  "used_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "auth_challenges_email_purpose_idx" ON "auth_challenges" ("email", "purpose");
