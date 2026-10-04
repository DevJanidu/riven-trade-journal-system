import { config } from "dotenv";
import { and, gte, lt } from "drizzle-orm";
import { mockTrades } from "../lib/mock-trades";
import { calculateActualR, calculatePlannedRR, calculateResult } from "../lib/trading/calculations";
import { createTradeSchema } from "../lib/validations/trade";
import { getDb } from "../lib/db";
import { trades } from "../lib/db/schema";

const isProduction = process.env.NODE_ENV === "production";
config({ path: isProduction ? ".env.production.local" : ".env.development.local", quiet: true });
config({ path: isProduction ? ".env.production" : ".env.local", quiet: true });
config({ path: ".env", quiet: true });

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL before running the optional seed.");
  const existing = await getDb().select({ id: trades.id }).from(trades)
    .where(and(gte(trades.date, "2026-10-01"), lt(trades.date, "2026-11-01"))).limit(1);
  if (existing.length) { console.info("October 2026 already has trades. Seed skipped to avoid duplicates."); return; }
  const rows = mockTrades.map((sample, index) => {
    const input = createTradeSchema.parse({
      instrument: "XAUUSD", date: sample.date, session: sample.session, direction: sample.direction,
      entry: sample.entry, stopLoss: sample.stopLoss, takeProfit: sample.takeProfit,
      riskAmount: sample.riskAmount, profitLoss: index === 11 ? 0 : sample.profitLoss,
      setup: sample.setup, tradingViewUrl: sample.tradingViewUrl,
      beforeScreenshot: sample.beforeScreenshot, afterScreenshot: sample.afterScreenshot,
      entryReason: sample.entryReason, wentWell: sample.wentWell, wentWrong: sample.wentWrong,
      improvement: sample.improvement, followedRules: sample.followedRules, emotion: sample.emotion,
    });
    return {
      ...input,
      entry: input.entry.toFixed(2), stopLoss: input.stopLoss.toFixed(2), takeProfit: input.takeProfit.toFixed(2),
      riskAmount: input.riskAmount.toFixed(2), profitLoss: input.profitLoss.toFixed(2),
      profitBooked: input.profitBooked.toFixed(2), breakEvenAfterProfit: input.breakEvenAfterProfit,
      plannedRR: calculatePlannedRR(input.entry, input.stopLoss, input.takeProfit, input.direction).toFixed(4),
      actualR: calculateActualR(input.profitLoss, input.riskAmount).toFixed(4), result: calculateResult(input.profitLoss),
      tradingViewUrl: input.tradingViewUrl ?? null, beforeScreenshot: input.beforeScreenshot ?? null,
      afterScreenshot: input.afterScreenshot ?? null,
    };
  });
  await getDb().insert(trades).values(rows);
  console.info(`Seeded ${rows.length} XAUUSD trades for October 2026.`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
