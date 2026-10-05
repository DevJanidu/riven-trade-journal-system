import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

config({ path: process.env.NODE_ENV === "production" ? ".env.production" : ".env.development.local", quiet: true });
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is missing");
const client = neon(process.env.DATABASE_URL);
const migration = readFileSync(resolve("drizzle/0005_auth_otp.sql"), "utf8");
async function main() {
  await client.transaction(migration.split("--> statement-breakpoint").map(statement => client.query(statement.trim())));
  await client.query('ALTER TABLE "auth_challenges" ADD COLUMN IF NOT EXISTS "verified_at" timestamptz');
  console.log("OTP migration applied.");
}
main().catch(() => { console.error("OTP migration failed. Check the database connection and retry."); process.exitCode = 1; });
