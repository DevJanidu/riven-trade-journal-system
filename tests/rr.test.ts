import assert from "node:assert/strict";
import test from "node:test";
import { formatR, formatRR } from "../lib/utils";
import { calculateAverageRR, calculatePlannedRR, calculateStats } from "../lib/trading/calculations";
import type { Trade } from "../types/trade";

const cases: Array<[number | string | null | undefined, string]> = [
  [1, "1:1"], [1.0, "1:1"], [1.5, "1:1.5"],
  [2, "1:2"], [2.0, "1:2"], [2.00, "1:2"], ["2.00", "1:2"], ["2.0", "1:2"], ["2.000", "1:2"],
  [2.25, "1:2.25"], [2.5, "1:2.5"], [2.50, "1:2.5"], ["2.50", "1:2.5"],
  [3, "1:3"], [3.0, "1:3"], ["3.00", "1:3"], [3.75, "1:3.75"],
  [4, "1:4"], [5, "1:5"], ["5.0", "1:5"], ["5.00", "1:5"], ["5.0000", "1:5"], [50, "1:50"], ["50.00", "1:50"], [8, "1:8"], [10, "1:10"], [10.5, "1:10.5"],
  [19, "1:19"], [19.0, "1:19"], [20, "1:20"], [20.0, "1:20"], ["20.00", "1:20"], [20.5, "1:20.5"],
  [2.333333, "1:2.33"], [2.666666, "1:2.67"], ["3.50", "1:3.5"], [4.25, "1:4.25"],
  [1.005, "1:1.01"], [2.675, "1:2.68"], [10.075, "1:10.08"],
  [null, "—"], [undefined, "—"], ["", "—"], ["   ", "—"], ["invalid", "—"],
  [NaN, "—"], [Infinity, "—"], [-Infinity, "—"], ["Infinity", "—"],
];

for (const [index, [value, expected]] of cases.entries()) {
  test(`R:R case ${index + 1}: ${String(value)} (${typeof value}) → ${expected}`, () => {
    assert.equal(formatRR(value), expected);
  });
}

const base: Trade = {
  id: "00000000-0000-4000-8000-000000000001", date: "2026-10-05", instrument: "XAUUSD",
  session: "London", direction: "Long", entry: 4000, stopLoss: 3990, takeProfit: 4020,
  riskAmount: 25, plannedRR: 2, actualR: 2, profitLoss: 50, result: "Win", setup: "Liquidity Sweep",
  entryReason: "", wentWell: "", wentWrong: "", improvement: "", followedRules: true, emotion: "Calm",
  createdAt: "2026-10-05T00:00:00Z", updatedAt: "2026-10-05T00:00:00Z",
};

test("average planned R:R is the arithmetic mean of numeric ratios", () => {
  const trades = [2, 3, 4].map(plannedRR => ({ ...base, plannedRR }));
  assert.equal(calculateAverageRR(trades), 3);
  assert.equal(calculateStats(trades).averagePlannedRR, 3);
  assert.equal(formatRR(calculateAverageRR(trades)), "1:3");
  assert.equal(calculateAverageRR([]), 0);
});

test("PostgreSQL numeric strings preserve 2.00, 2.50 and 20.00 through the average", () => {
  for (const [stored, expected] of [["2.00", "1:2"], ["2.50", "1:2.5"], ["20.00", "1:20"]]) {
    const trades = [1, 2, 3].map(() => ({ ...base, plannedRR: Number(stored) }));
    assert.equal(formatRR(calculateStats(trades).averagePlannedRR), expected);
  }
});

test("calculated averages preserve meaningful precision up to two decimal places", () => {
  assert.equal(formatRR(calculateAverageRR([2, 2, 3].map(plannedRR => ({ ...base, plannedRR })))), "1:2.33");
  assert.equal(formatRR(calculateAverageRR([2, 3, 3].map(plannedRR => ({ ...base, plannedRR })))), "1:2.67");
});

test("price geometry distinguishes a two-R target from a twenty-R target", () => {
  assert.equal(formatRR(calculatePlannedRR(4000, 3990, 4020, "Long")), "1:2");
  assert.equal(formatRR(calculatePlannedRR(4000, 3990, 4200, "Long")), "1:20");
});

test("the Dashboard example retains +8.8R performance and a separate 1:2 planned ratio", () => {
  const trades = [2.5, 3.1, 3.2].map(actualR => ({ ...base, actualR }));
  const summary = calculateStats(trades);
  assert.equal(summary.totalTrades, 3);
  assert.equal(summary.averagePlannedRR, 2);
  assert.equal(formatRR(summary.averagePlannedRR), "1:2");
  assert.equal(formatR(summary.netR), "+8.8R");
});
