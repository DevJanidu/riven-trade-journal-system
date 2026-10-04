import assert from "node:assert/strict";
import test from "node:test";
import { calculateActualR, calculateCumulativeR, calculatePlannedRR, calculateResult, calculateSetupPerformance, calculateStats, getTradesForMonth, monthBounds } from "../lib/trading/calculations";
import type { Trade } from "../types/trade";

const base: Trade = {
  id: "00000000-0000-4000-8000-000000000001", date: "2026-10-01", instrument: "XAUUSD", session: "London", direction: "Long",
  entry: 3942.5, stopLoss: 3937.5, takeProfit: 3952.5, riskAmount: 25, plannedRR: 2,
  actualR: 2, profitLoss: 50, result: "Win", setup: "Liquidity Sweep",
  entryReason: "", wentWell: "", wentWrong: "", improvement: "", followedRules: true, emotion: "Calm",
  createdAt: "2026-10-01T12:00:00.000Z", updatedAt: "2026-10-01T12:00:00.000Z",
};

test("planned R:R handles long and short geometry", () => {
  assert.equal(calculatePlannedRR(100, 95, 110, "Long"), 2);
  assert.equal(calculatePlannedRR(100, 105, 90, "Short"), 2);
  assert.equal(calculatePlannedRR(100, 105, 110, "Long"), 0);
});

test("actual R and result derive from dollar P/L", () => {
  assert.equal(calculateActualR(50, 25), 2);
  assert.equal(calculateActualR(-25, 25), -1);
  assert.equal(calculateResult(0), "Break Even");
});

test("summary excludes break-even from win rate and sums R", () => {
  const trades = [base, { ...base, id: "2", actualR: -1, result: "Loss" as const }, { ...base, id: "3", actualR: 0, result: "Break Even" as const }];
  const summary = calculateStats(trades);
  assert.equal(summary.winRate, 50);
  assert.equal(summary.netR, 1);
  assert.equal(summary.breakEvens, 1);
  assert.equal(summary.averageR, 0.3333);
  assert.equal(calculateSetupPerformance(trades)[0].trades, 3);
});

test("cumulative R sorts date and creation time deterministically", () => {
  const trades = [
    { ...base, id: "2", date: "2026-10-02", actualR: -1 },
    { ...base, id: "1", date: "2026-10-01", actualR: 2 },
    { ...base, id: "3", date: "2026-10-02", actualR: 0.5, createdAt: "2026-10-02T15:00:00.000Z" },
  ];
  assert.deepEqual(calculateCumulativeR(trades).map(point => point.value), [2, 1, 1.5]);
});

test("month boundaries include leap-day and exclude next month", () => {
  assert.deepEqual(monthBounds("2028-02"), { start: "2028-02-01", end: "2028-03-01" });
  const trades = [{ ...base, date: "2028-02-29" }, { ...base, date: "2028-03-01" }];
  assert.equal(getTradesForMonth(trades, "2028-02").length, 1);
});
