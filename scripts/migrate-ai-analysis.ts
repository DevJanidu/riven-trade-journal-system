import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

config({ path: process.env.NODE_ENV === "production" ? ".env.production" : ".env.development.local", quiet: true });
config({ path: ".env", quiet: true });
async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL missing");
  const client = neon(process.env.DATABASE_URL);
  const [existing] = await client`SELECT to_regclass('public.gold_weekly_analyses') AS analyses, to_regclass('public.market_data_cache') AS cache, to_regclass('public.gold_generation_locks') AS locks`;
  if (existing.analyses && existing.cache && existing.locks) { console.info("AI Analysis tables already present."); return; }
  if (existing.analyses || existing.cache || existing.locks) throw new Error("Partial migration detected");
  const migration = readFileSync(resolve("drizzle/0006_confused_phalanx.sql"), "utf8");
  await client.transaction(migration.split("--> statement-breakpoint").map(statement => statement.trim()).filter(Boolean).map(statement => client.query(statement)));
  console.info("AI Analysis migration applied atomically. Existing journal tables unchanged.");
}
main().catch(() => { console.error("AI Analysis migration failed. Check the database connection and migration state."); process.exitCode = 1; });
