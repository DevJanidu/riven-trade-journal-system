import { config } from "dotenv";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { randomInt } from "node:crypto";
import { z } from "zod";
import { getDb } from "../lib/db";
import { trades } from "../lib/db/schema";

config({ path: ".env.development.local", quiet: true }); config({ path: ".env", quiet: true });
const userId = z.string().uuid().parse(process.argv[2]);
const marker = "[SAMPLE SEED: JAN-OCT 2026 / 100 TRADES]";
function shuffled<T>(values: T[]): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) { const j = randomInt(i + 1); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}
async function main() {
  const db = getDb();
  const existing = await db.select({ id: trades.id, date: trades.date, entryReason: trades.entryReason, result: trades.result }).from(trades)
    .where(and(eq(trades.userId, userId), gte(trades.date, "2026-01-01"), lt(trades.date, "2026-11-01")));
  const samples = existing.filter(row => row.entryReason.startsWith(marker));
  if (samples.length !== 100) throw new Error("Expected exactly 100 labeled sample trades. No dates changed.");
  const otherCounts = Array.from({ length: 10 }, (_, index) => existing.filter(row => !row.entryReason.startsWith(marker) && Number(row.date.slice(5, 7)) === index + 1).length);
  if (otherCounts.some(count => count > 5)) throw new Error("Insufficient monthly capacity for this random distribution. No dates changed.");
  let counts: number[] = [];
  for (let attempt = 0; attempt < 100000; attempt++) {
    const candidate = otherCounts.map(count => randomInt(7, 13 - count));
    if (candidate.reduce((a, b) => a + b, 0) === 100 && new Set(candidate).size >= 4) { counts = candidate; break; }
  }
  if (!counts.length) throw new Error("Could not create a varied distribution within monthly limits. No dates changed.");
  // Guarantee each month retains at least one win, loss and break-even.
  const groups = ["Win", "Loss", "Break Even"].map(result => shuffled(samples.filter(row => row.result === result)));
  if (groups.some(group => group.length < 10)) throw new Error("Need at least ten trades of each result to distribute across all months.");
  const months = Array.from({ length: 10 }, () => groups.map(group => group.pop()!));
  const remaining = shuffled(groups.flat());
  const updates: { id: string; date: string }[] = [];
  for (let month = 1; month <= 10; month++) {
    const rows = months[month - 1];
    while (rows.length < counts[month - 1]) rows.push(remaining.pop()!);
    const weekdays: string[] = [];
    for (let day = 1; day <= new Date(Date.UTC(2026, month, 0)).getUTCDate(); day++) {
      const date = new Date(Date.UTC(2026, month - 1, day));
      if (![0, 6].includes(date.getUTCDay())) weekdays.push(date.toISOString().slice(0, 10));
    }
    const dates = shuffled(weekdays);
    rows.forEach((row, index) => updates.push({ id: row.id, date: dates[index] }));
  }
  console.info(JSON.stringify({ userId, monthlyCounts: counts, total: updates.length }, null, 2));
  if (!process.argv.includes("--apply")) return;
  // One atomic statement modifies only this user's labeled sample batch.
  const changed = await db.execute(sql`WITH moved AS (
    SELECT * FROM jsonb_to_recordset(${JSON.stringify(updates)}::jsonb) AS x(id uuid, date date)
  ) UPDATE trades SET date = moved.date, updated_at = now() FROM moved
    WHERE trades.id = moved.id AND trades.user_id = ${userId}::uuid AND trades.entry_reason LIKE ${`${marker}%`}
    RETURNING trades.id`);
  if (changed.rows.length !== 100) throw new Error("Unexpected updated count. Verify this batch before rerunning.");
  const { deleteCached } = await import("../lib/cache");
  await deleteCached(...counts.flatMap((_, index) => {
    const month = `2026-${String(index + 1).padStart(2, "0")}`;
    return [`tradezilla:trades:${userId}:${month}`, `tradezilla:dashboard:${userId}:${month}`];
  }));
  const result = await db.execute(sql`SELECT to_char(date, 'YYYY-MM') AS month, count(*)::int AS total,
    count(*) FILTER (WHERE result = 'Win')::int AS wins,
    count(*) FILTER (WHERE result = 'Loss')::int AS losses,
    count(*) FILTER (WHERE result = 'Break Even')::int AS break_evens
    FROM trades WHERE user_id = ${userId}::uuid AND date >= '2026-01-01' AND date < '2026-11-01'
    GROUP BY 1 ORDER BY 1`);
  console.info(JSON.stringify({ updated: changed.rows.length, verifiedMonths: result.rows }, null, 2));
}
main().catch(() => { console.error("Sample redistribution failed. No credentials printed."); process.exitCode = 1; });
