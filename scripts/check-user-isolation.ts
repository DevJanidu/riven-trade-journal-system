import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: process.env.NODE_ENV === "production" ? ".env.production" : ".env.development.local", quiet: true });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is missing");
const sql = neon(databaseUrl);

async function main() {
  const [counts] = await sql`SELECT
    (SELECT count(*)::int FROM users) AS users,
    (SELECT count(*)::int FROM trades WHERE user_id IS NULL) AS orphan_trades,
    (SELECT count(*)::int FROM trade_drafts WHERE user_id IS NULL) AS orphan_drafts,
    (SELECT count(*)::int FROM setup_types WHERE user_id IS NULL) AS orphan_setups`;
  const columns = await sql`SELECT table_name, is_nullable FROM information_schema.columns
    WHERE table_schema = 'public' AND column_name = 'user_id'
      AND table_name IN ('trades', 'trade_drafts', 'setup_types') ORDER BY table_name`;

  const orphanCount = Number(counts.orphan_trades) + Number(counts.orphan_drafts) + Number(counts.orphan_setups);
  if (Number(counts.users) > 0 && orphanCount > 0) throw new Error(`Isolation check failed: ${orphanCount} trading records have no owner`);
  if (Number(counts.users) > 0 && columns.some(column => column.is_nullable === "YES")) throw new Error("Isolation check failed: one or more ownership columns are nullable");

  console.info(JSON.stringify({
    users: Number(counts.users),
    orphanTrades: Number(counts.orphan_trades),
    orphanDrafts: Number(counts.orphan_drafts),
    orphanSetups: Number(counts.orphan_setups),
    ownershipColumns: columns,
    status: Number(counts.users) === 0 ? "ready-first-registration-will-claim-legacy-data" : "isolated",
  }, null, 2));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
