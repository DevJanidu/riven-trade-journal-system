import assert from "node:assert/strict";
import test from "node:test";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { getGoldMarketData, normalizeGold, parseGoldHistory, parseGoldSpot } from "../lib/market-data/alpha-vantage";
import { normalizeFred, parseFredObservations, getFredIndicator } from "../lib/market-data/fred";
import { FRED_SERIES } from "../lib/market-data/fred-series";
import { getGoldCotData, normalizeCot } from "../lib/market-data/cftc";
import { basisPointChange, isStale, tradingWeek, isoDay } from "../lib/market-data/calculations";
import { collectSnapshot } from "../lib/market-data/snapshot";
import { calculateDataQuality } from "../lib/market-data/data-quality";
import { analysisRequest, analyzeGold } from "../lib/ai/gold-analysis";
import { generateAnalysisSchema, goldWeeklyAnalysisSchema, technicalAlignment, technicalContextSchema, validateAnalysis } from "../lib/ai/schemas";
import { runGeneration } from "../lib/ai/generate";
import type { GenerationDependencies } from "../lib/ai/generate";
import type { GoldAnalysisSnapshot, MacroIndicator } from "../lib/market-data/types";

// Synthetic fixtures are strictly test-only and never shown as live market data.
export function syntheticAnalysis() {
  const scenario = { probability: 34, conditions: ["Synthetic test condition"], explanation: "Synthetic test scenario", invalidation: ["Synthetic test invalidation"] };
  return { bias: "neutral" as const, confidence: 80, probabilities: { bullish: 33.3, bearish: 33.3, range: 33.4 }, summary: "Synthetic analysis for validation tests only",
    macroScorecard: ["gold", "us2y", "us10y"].map(indicatorKey => ({ indicatorKey, goldImpact: "neutral" as const, importance: "medium" as const, explanation: "Synthetic interpretation" })),
    keyDrivers: ["Test driver one", "Test driver two", "Test driver three"], bullishScenario: { ...scenario }, bearishScenario: { ...scenario }, rangeScenario: { probability: 32, conditions: ["Test condition"], explanation: "Test explanation" },
    recentMacroDevelopments: [], risks: ["Test risk"], whatWouldChangeBias: ["Test change"] };
}
const quality = { completeness: 70, missingData: ["Test missing data"], staleData: [], warnings: [], confidenceCap: 60 };
function syntheticSnapshot(): GoldAnalysisSnapshot {
  const now = new Date(); const date = isoDay(now);
  const gold = normalizeGold({ price: 100, observationDate: date }, [{ date, value: 100 }], [], now);
  const macro: Record<string, MacroIndicator> = Object.fromEntries(FRED_SERIES.map(config => [config.key, normalizeFred(config, [{ date, value: 3 }, { date: "2020-01-01", value: 2 }], now)]));
  const week = tradingWeek(now);
  return { analysisDate: now.toISOString(), weekStart: week.start, weekEnd: week.end, gold, macro, positioning: null, upcomingEvents: [], consensus: null, news: null, fedMarketProbabilities: null, dataQuality: quality };
}

test("Alpha Vantage spot, history and missing prices are parsed defensively", () => {
  assert.equal(parseGoldSpot({ nominal: "XAUUSD", timestamp: "2026-10-05 08:00:00", price: "100" }).price, 100);
  assert.equal(parseGoldSpot({ nominal: "XAUUSD", timestamp: "2026-10-05", price: "." }).price, null);
  assert.equal(parseGoldHistory({ data: [{ date: "2026-10-02", price: "100" }, { date: "2026-10-01", price: "." }] }).length, 1);
  assert.throws(() => parseGoldSpot({ nominal: "XAGUSD", price: "100" }));
  assert.throws(() => parseGoldHistory({ Information: "Rate limit" }), /rate limit/);
});
test("Gold close changes preserve unavailable true OHLC and previous trading-day close", () => {
  const snapshot = normalizeGold({ price: 110, observationDate: "2026-10-05" }, [{ date: "2026-10-02", value: 105 }, { date: "2026-09-25", value: 100 }, { date: "2026-09-04", value: 90 }], [], new Date("2026-10-05"));
  assert.equal(snapshot.previousClose, 105); assert.equal(snapshot.weeklyChangePercent, 5); assert.equal(snapshot.weeklyHigh, null);
  assert.equal(snapshot.weeklyCloseHigh, 105); assert.equal(snapshot.historyWeekStart, "2026-09-28");
});
test("FRED skips dots, malformed values, and future observations", () => {
  const rows = parseFredObservations({ observations: [{ date: "2026-10-01", value: "." }, { date: "2026-09-30", value: "4.32" }, { date: "2099-01-01", value: "10" }] }, new Date("2026-10-05"));
  assert.equal(rows.length, 1); assert.equal(rows[0].value, 4.32);
  assert.throws(() => parseFredObservations({ error_code: 400 }));
});
test("basis point math handles 4.20 to 4.32 correctly", () => {
  assert.equal(basisPointChange(4.32, 4.20), 12); assert.equal(basisPointChange(null, 4.20), null);
});
test("daily yields use approximately previous week; release frequencies govern staleness", () => {
  const config = FRED_SERIES.find(row => row.key === "us10y")!;
  const row = normalizeFred(config, [{ date: "2026-10-02", value: 4.32 }, { date: "2026-09-25", value: 4.20 }], new Date("2026-10-05"));
  assert.equal(row.changeBps, 12); assert.equal(row.forecast, null); assert.equal(row.stale, false);
  assert.equal(isStale("2026-09-01", "monthly", new Date("2026-10-05")), false);
  assert.equal(isStale("2026-01-01", "monthly", new Date("2026-10-05")), true);
});
test("inflation MoM/YoY require exact comparison months, payroll levels convert to jobs", () => {
  const cpi = FRED_SERIES.find(row => row.key === "cpi")!;
  const row = normalizeFred(cpi, [{ date: "2026-09-01", value: 103 }, { date: "2026-08-01", value: 102 }, { date: "2025-09-01", value: 100 }], new Date("2026-10-05"));
  assert.equal(row.yoyPercent, 3); assert.equal(row.momPercent, 0.9804);
  const missingMonth = normalizeFred(cpi, [{ date: "2026-09-01", value: 103 }, { date: "2026-07-01", value: 100 }]);
  assert.equal(missingMonth.momPercent, null);
  const payroll = normalizeFred(FRED_SERIES.find(row => row.key === "payrolls")!, [{ date: "2026-09-01", value: 150135 }, { date: "2026-08-01", value: 150000 }, { date: "2026-07-01", value: 149840 }]);
  assert.equal(payroll.payrollChangePersons, 135000); assert.equal(payroll.previousPayrollChangePersons, 160000);
});
test("FRED failures are safe and quota responses are not retried", async () => {
  const oldKey = process.env.FRED_API_KEY; process.env.FRED_API_KEY = "test-key";
  let calls = 0;
  try {
    await assert.rejects(getFredIndicator(FRED_SERIES[0], async () => { calls++; return new Response("{}", { status: 429 }); }), /rate limit/);
    assert.equal(calls, 1);
  } finally { if (oldKey === undefined) delete process.env.FRED_API_KEY; else process.env.FRED_API_KEY = oldKey; }
});
test("CFTC computes managed money net and weekly change; missing data fails safely", async () => {
  const rows = [{ cftc_contract_market_code: "088691", market_and_exchange_names: "GOLD - COMMODITY EXCHANGE INC.", report_date_as_yyyy_mm_dd: "2026-09-29T00:00:00", m_money_positions_long_all: "100", m_money_positions_short_all: "20" }, { cftc_contract_market_code: "088691", market_and_exchange_names: "GOLD - COMMODITY EXCHANGE INC.", report_date_as_yyyy_mm_dd: "2026-09-22T00:00:00", m_money_positions_long_all: "90", m_money_positions_short_all: "15" }];
  const cot = normalizeCot(rows, new Date("2026-10-05")); assert.equal(cot.net, 80); assert.equal(cot.weeklyNetChange, 5);
  assert.throws(() => normalizeCot([]), /unavailable/);
  await assert.rejects(getGoldCotData(async () => new Response("{}", { status: 403 })), /invalid/);
});
test("OpenAI strict schema validates; integer probabilities total exactly 100 and confidence is capped", () => {
  const analysis = validateAnalysis(syntheticAnalysis(), quality, ["gold", "us2y", "us10y"]);
  assert.deepEqual(analysis.probabilities, { bullish: 33, bearish: 33, range: 34 });
  assert.equal(analysis.confidence, 60); assert.equal(analysis.rangeScenario.probability, 34);
  const schema = zodTextFormat(goldWeeklyAnalysisSchema, "gold_analysis"); assert.equal(schema.strict, true);
  assert.throws(() => validateAnalysis({ ...syntheticAnalysis(), probabilities: { bullish: 50, bearish: 30, range: 25 } }, quality, ["gold", "us2y", "us10y"]));
  assert.throws(() => validateAnalysis(null, quality, []));
  assert.throws(() => validateAnalysis({ ...syntheticAnalysis(), confidence: 101 }, quality, ["gold", "us2y", "us10y"]));
});
test("technical bias is never modified and alignment is deterministic", () => {
  assert.equal(technicalAlignment("moderately_bearish", "bearish"), "aligned");
  assert.equal(technicalAlignment("moderately_bearish", "bullish"), "conflicting");
  assert.equal(technicalAlignment("neutral", "bullish"), "partially_aligned");
  assert.equal(technicalAlignment("neutral", "not_set"), "technical_not_provided");
  assert.throws(() => technicalContextSchema.parse({ userId: "injected" }));
  assert.throws(() => technicalContextSchema.parse({ notes: "x".repeat(1501) }));
});
test("CFTC partial failure reduces coverage while critical source failure stops generation", async () => {
  const fixture = syntheticSnapshot();
  const snapshot = await collectSnapshot({ gold: async () => fixture.gold!, macro: async () => fixture.macro, cot: async () => { throw new Error("unavailable"); } });
  assert.equal(snapshot.positioning, null); assert.ok(snapshot.dataQuality.missingData.includes("Gold CFTC positioning"));
  const complete = calculateDataQuality(fixture.gold, fixture.macro, null, []); assert.ok(complete.completeness < 100);
  await assert.rejects(collectSnapshot({ gold: async () => { throw new Error("failed"); }, macro: async () => fixture.macro, cot: async () => { throw new Error("failed"); } }), /Insufficient/);
});
test("one generation is one LLM call; save failure releases lock without retrying LLM", async () => {
  let calls = 0; let released = 0; const snapshot = syntheticSnapshot();
  const deps: GenerationDependencies<string> = {
    claim: async () => "token", collect: async () => snapshot,
    analyze: async () => { calls++; return validateAnalysis(syntheticAnalysis(), quality, ["gold", "us2y", "us10y"]); },
    save: async () => { throw new Error("SQL secret must not escape"); }, release: async () => { released++; },
  };
  await assert.rejects(runGeneration("test-user", technicalContextSchema.parse({}), deps), /Analysis could not be saved/);
  assert.equal(calls, 1); assert.equal(released, 1);
  await assert.rejects(runGeneration("test-user", technicalContextSchema.parse({}), { ...deps, claim: async () => { throw new Error("cooldown"); } }), /cooldown/);
  assert.equal(calls, 1);
});
test("Responses request uses the requested model, medium reasoning, no tools and no raw observation arrays", () => {
  const params = analysisRequest(syntheticSnapshot());
  assert.deepEqual(Object.keys(JSON.parse(params.input[1].content)), ["snapshot"], "Only provider snapshot reaches the model");
  assert.deepEqual(generateAnalysisSchema.parse({}), {});
  assert.throws(() => generateAnalysisSchema.parse({ technicalContext: { bias: "bearish" } }));
  assert.equal(params.model, "gpt-6-luna"); assert.equal(params.reasoning.effort, "medium"); assert.equal(params.store, false);
  assert.ok(!("tools" in params)); assert.ok(params.input[1].content.length < 22000);
});
test("trading week is Monday-Friday UTC across year boundaries", () => {
  assert.deepEqual(tradingWeek(new Date("2027-01-03T23:00:00Z")), { start: "2026-12-28", end: "2027-01-01" });
});
test("Alpha Vantage partial history failure preserves actual spot without fabricated history", async () => {
  const original = process.env.ALPHA_VANTAGE_API_KEY; process.env.ALPHA_VANTAGE_API_KEY = "test-key";
  let calls = 0;
  try {
    const gold = await getGoldMarketData(async () => { calls++; return Response.json(calls === 1 ? { nominal: "XAUUSD", timestamp: isoDay(new Date()), price: "100" } : { Information: "Rate limit" }); });
    assert.equal(calls, 2); assert.equal(gold.latestPrice, 100); assert.equal(gold.weeklyChangePercent, null);
  } finally { if (original === undefined) delete process.env.ALPHA_VANTAGE_API_KEY; else process.env.ALPHA_VANTAGE_API_KEY = original; }
});

test("official SDK makes one structured request and rejects malformed output without a retry", async () => {
  let calls = 0; let invalid = false;
  const client = new OpenAI({ apiKey: "test-key", maxRetries: 0, fetch: async (_url, init) => {
    calls++;
    const request = JSON.parse(String(init?.body));
    assert.equal(request.text.format.type, "json_schema"); assert.equal(request.text.format.strict, true);
    assert.equal(request.reasoning.effort, "medium");
    return Response.json({ id: "resp_test", object: "response", created_at: 1, status: "completed", model: "gpt-6-luna",
      output: [{ id: "msg_test", type: "message", role: "assistant", status: "completed", content: [{ type: "output_text", annotations: [], text: invalid ? "invalid-json" : JSON.stringify(syntheticAnalysis()) }] }] });
  } });
  const result = await analyzeGold(syntheticSnapshot(), client);
  assert.equal(calls, 1); assert.equal(result.probabilities.range, 34);
  invalid = true;
  await assert.rejects(analyzeGold(syntheticSnapshot(), client));
  assert.equal(calls, 2, "Exactly one request per attempt, including malformed response");
});
