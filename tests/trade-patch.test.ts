import assert from "node:assert/strict";
import test from "node:test";
import { buildTradePatch } from "../lib/trading/trade-patch";
import { updateTradeSchema } from "../lib/validations/trade";
import type { Trade } from "../types/trade";

const original = {
  id: "00000000-0000-4000-8000-000000000001",
  date: "2026-10-04", instrument: "XAUUSD", session: "London", direction: "Long",
  entry: 4000, stopLoss: 3990, takeProfit: 4020, riskAmount: 25,
  plannedRR: 2, actualR: 2, profitLoss: 50, profitBooked: 0,
  breakEvenAfterProfit: false, result: "Win", setup: "Liquidity Sweep",
  setupGrade: "A", setupChecklist: ["Wait"], setupAvoidChecklist: [],
  psychologyReady: true, psychologyAnswer: "Ready", followedRules: true,
  emotion: "Calm", entryReason: "Entry", wentWell: "", wentWrong: "", improvement: "",
  beforeScreenshot: "trades/old/before.webp", afterScreenshot: "trades/old/after.webp",
  createdAt: "2026-10-04T00:00:00.000Z", updatedAt: "2026-10-04T00:00:00.000Z",
} as Trade;

test("normal text edit sends only the changed field and no existing image references", () => {
  const patch = buildTradePatch(original, { ...original, emotion: "Confident" });
  assert.deepEqual(patch, { emotion: "Confident" });
  assert.deepEqual(updateTradeSchema.parse(patch), patch);
});

test("dirty fields preserve false, zero, empty string and null", () => {
  const patch = buildTradePatch(original, {
    ...original, followedRules: false, profitLoss: 0, entryReason: "", beforeScreenshot: null,
  });
  assert.deepEqual(patch, { profitLoss: 0, beforeScreenshot: null, entryReason: "", followedRules: false });
  assert.deepEqual(updateTradeSchema.parse(patch), patch);
});

test("unchanged form creates no PATCH, including optional defaults and arrays", () => {
  const patch = buildTradePatch(original, {
    ...original, setupChecklist: ["Wait"], setupAvoidChecklist: [], tradingViewUrl: null,
  });
  assert.deepEqual(patch, {});
  assert.deepEqual(buildTradePatch({ ...original, tradingViewUrl: "" }, {
    ...original, tradingViewUrl: null,
  }), {});
});

test("partial validation does not inject create defaults", () => {
  assert.deepEqual(updateTradeSchema.parse({ wentWell: "Updated" }), { wentWell: "Updated" });
  assert.deepEqual(updateTradeSchema.parse({ tradingViewUrl: null }), { tradingViewUrl: null });
});
