import { config } from "dotenv";
import { and, eq, gte, lt } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../lib/db";
import { trades, users } from "../lib/db/schema";
import { createTradeSchema } from "../lib/validations/trade";
import { calculateActualR, calculatePlannedRR, calculateResult } from "../lib/trading/calculations";
import { sessions, setups } from "../types/trade";

config({ path: process.argv.includes("--production") ? ".env.production" : ".env.development.local", quiet: true }); config({ path: ".env", quiet: true });
const ownerId = z.string().uuid().parse(process.argv[2]);
const marker = "[SAMPLE SEED: JAN-OCT 2026 / 100 TRADES]";

async function main() {
  const db = getDb();
  const [owner] = await db.select({ id: users.id }).from(users).where(eq(users.id, ownerId)).limit(1);
  if (!owner) throw new Error("The requested user does not exist. No trades inserted.");
  const existing = await db.select({ date: trades.date, entryReason: trades.entryReason }).from(trades)
    .where(and(eq(trades.userId, ownerId), gte(trades.date, "2026-01-01"), lt(trades.date, "2026-11-01")));
  if (existing.some(row => row.entryReason.startsWith(marker))) throw new Error("This sample batch is already present. No duplicate trades inserted.");
  const counts = Array.from({ length: 10 }, (_, month) => existing.filter(row => Number(row.date.slice(5, 7)) === month + 1).length);
  const capacity = counts.map(count => Math.max(0, 12 - count));
  if (counts.some(count => count > 12) || capacity.reduce((a, b) => a + b, 0) < 100) throw new Error(`Cannot add 100 trades while keeping each month at or below 12. Existing monthly counts: ${counts.join(", ")}. No trades changed.`);
  const planned = capacity.map(remaining => Math.min(10, remaining));
  for (let remaining = 100 - planned.reduce((a, b) => a + b, 0); remaining > 0;) {
    for (let month = 0; month < 10 && remaining > 0; month++) if (planned[month] < capacity[month]) { planned[month]++; remaining--; }
  }
  const rows: (typeof trades.$inferInsert)[] = [];
  for (let month = 1; month <= 10; month++) {
    const weekdays: string[] = [];
    for (let day = 1; day <= new Date(Date.UTC(2026, month, 0)).getUTCDate(); day++) {
      const date = new Date(Date.UTC(2026, month - 1, day));
      if (![0, 6].includes(date.getUTCDay())) weekdays.push(date.toISOString().slice(0, 10));
    }
    for (let index = 0; index < planned[month - 1]; index++) {
      const serial = rows.length; const direction = serial % 2 ? "Short" : "Long";
      const entry = 2800 + month * 35 + index * 4;
      const stopDistance = 8 + serial % 5; const rr = [1.5, 2, 2.5, 3][serial % 4]; const risk = [50, 75, 100][serial % 3];
      const outcome = index % 10; const profitLoss = outcome < 5 ? risk * rr : outcome < 8 ? -risk : 0;
      const input = createTradeSchema.parse({ instrument: "XAUUSD", date: weekdays[Math.floor(index * weekdays.length / planned[month - 1])],
        session: sessions[serial % sessions.length], direction, entry,
        stopLoss: entry + (direction === "Long" ? -stopDistance : stopDistance), takeProfit: entry + (direction === "Long" ? 1 : -1) * stopDistance * rr,
        riskAmount: risk, profitLoss, setup: setups[serial % setups.length], followedRules: outcome !== 7,
        emotion: outcome < 5 ? "Confident" : outcome < 8 ? "Fear" : "Calm",
        entryReason: `${marker} Synthetic trade ${serial + 1}/100. Fictional prices and outcome for journal testing; not a real executed trade.`,
        wentWell: profitLoss > 0 ? "Sample: followed the planned setup and target." : "Sample: kept risk defined.",
        wentWrong: profitLoss < 0 ? "Sample: setup invalidated and stop was reached." : "",
        improvement: "Sample: review entry timing and execution consistency.",
      });
      rows.push({ ...input, userId: ownerId, entry: input.entry.toFixed(2), stopLoss: input.stopLoss.toFixed(2), takeProfit: input.takeProfit.toFixed(2),
        riskAmount: input.riskAmount.toFixed(2), profitLoss: input.profitLoss.toFixed(2), profitBooked: "0",
        plannedRR: calculatePlannedRR(input.entry, input.stopLoss, input.takeProfit, direction).toFixed(4),
        actualR: calculateActualR(profitLoss, risk).toFixed(4), result: calculateResult(profitLoss) });
    }
  }
  console.info(JSON.stringify({ userId: ownerId, year: 2026, existingCounts: counts, plannedCounts: planned, totalToInsert: rows.length, results: { wins: rows.filter(row => row.result === "Win").length, losses: rows.filter(row => row.result === "Loss").length, breakEvens: rows.filter(row => row.result === "Break Even").length } }, null, 2));
  if (!process.argv.includes("--apply")) { console.info("Preview only. Add --apply to insert this validated sample batch."); return; }
  const inserted = await db.insert(trades).values(rows).returning({ id: trades.id });
  if (inserted.length !== 100) throw new Error("Unexpected inserted count; verify this batch before rerunning.");
  const { deleteCached } = await import("../lib/cache");
  await deleteCached(...Array.from({ length: 10 }, (_, index) => {
    const month = `2026-${String(index + 1).padStart(2, "0")}`;
    return [`tradezilla:trades:${ownerId}:${month}`, `tradezilla:dashboard:${ownerId}:${month}`];
  }).flat());
  const saved = await db.select({ date: trades.date, result: trades.result, entryReason: trades.entryReason }).from(trades)
    .where(and(eq(trades.userId, ownerId), gte(trades.date, "2026-01-01"), lt(trades.date, "2026-11-01")));
  const months = Array.from({ length: 10 }, (_, index) => ({ month: `2026-${String(index + 1).padStart(2, "0")}`, total: saved.filter(row => Number(row.date.slice(5, 7)) === index + 1).length }));
  console.info(JSON.stringify({ inserted: inserted.length, verifiedSeedCount: saved.filter(row => row.entryReason.startsWith(marker)).length, months }, null, 2));
}
main().catch(error => { console.error(error instanceof Error && !error.message.includes("query:") && !error.message.includes("postgres") ? error.message : "Sample seed failed. No credentials printed."); process.exitCode = 1; });
