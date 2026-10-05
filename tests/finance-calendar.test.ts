import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { calculateConsensusCoverage, calculateEventSurprise, classifyGoldEvent, getFinanceCalendar, getHighImpactEvents, normalizeFinanceCalendar, safeEventUrl } from "../lib/market-data/finance-calendar";
import { calculateDataQuality } from "../lib/market-data/data-quality";
import { collectSnapshot } from "../lib/market-data/snapshot";
import { normalizeGold } from "../lib/market-data/alpha-vantage";
import { normalizeFred } from "../lib/market-data/fred";
import { FRED_SERIES } from "../lib/market-data/fred-series";
import { isoDay, tradingWeek } from "../lib/market-data/calculations";
import { analysisRequest } from "../lib/ai/gold-analysis";
import { EconomicCalendarSection } from "../components/ai-analysis/economic-calendar";

const from = "2026-10-05"; const to = "2026-10-09"; const now = new Date(`${from}T00:00:00Z`);
const event = (overrides: Record<string, unknown> = {}) => ({ date: "2026-10-09", name: "Nonfarm Payrolls", title: "US Nonfarm Payrolls", impact: "high", time_utc: "2026-10-09T12:30:00+00:00", time_et: "08:30", all_day: false, prior: "160K", consensus: "180K", actual: null, url: "https://www.financecalendar.com/event/test/", ...overrides });
const calendar = (events: unknown[], date = now) => normalizeFinanceCalendar({ from, to, events }, from, to, date);

test("calendar success preserves prior/consensus/actual and fetches bounded range server-side", async () => {
  let calls = 0;
  const result = await getFinanceCalendar(from, to, async url => {
    calls++; const query = new URL(String(url)); assert.equal(query.pathname, "/wp-json/fc/v1/calendar"); assert.equal(query.searchParams.get("limit"), "500");
    assert.equal(query.searchParams.get("from"), from); return Response.json({ from, to, events: [event()] });
  }, now);
  assert.equal(calls, 1); assert.equal(result.events[0].prior, "160K"); assert.equal(result.events[0].consensus, "180K"); assert.equal(result.events[0].actual, null);
  assert.equal(result.consensusCoverage.percent, 100); assert.equal(result.events[0].source, "FinanceCalendar");
  await getHighImpactEvents(from, to, async url => { assert.equal(new URL(String(url)).searchParams.get("impact"), "high"); return Response.json({ from, to, events: [] }); });
});
test("validated empty calendar has available period coverage, not invented consensus", () => {
  const result = calendar([]); assert.equal(result.events.length, 0); assert.equal(result.eventRisk, "low"); assert.equal(result.dailyRisk.length, 5); assert.equal(result.consensusCoverage.percent, null);
  const quality = calculateDataQuality(null, {}, null, [], now, result);
  assert.equal(quality.categories?.find(row => row.name === "Upcoming economic calendar")?.status, "AVAILABLE");
  assert.ok(quality.missingData.includes("Economic consensus"));
});
test("consensus coverage is fractional; actual stays separate and released events leave upcoming denominator", () => {
  const result = calendar([event(), event({ name: "CPI", title: "US Core CPI", date: "2026-10-07", time_utc: null, consensus: null }), event({ name: "ISM Services", title: "US ISM Services", date: from, time_utc: null, actual: "205K" })]);
  assert.equal(result.consensusCoverage.eligible, 2); assert.equal(result.consensusCoverage.available, 1); assert.equal(result.consensusCoverage.percent, 50);
  assert.equal(result.events.find(row => row.series === "cpi")?.consensus, null);
  assert.equal(calculateDataQuality(null, {}, null, [], now, result).categories?.find(row => row.name === "Economic consensus")?.status, "PARTIAL");
});
test("safe surprise math supports compatible units and rejects policy ranges and mixed units", () => {
  assert.deepEqual(calculateEventSurprise("205K", "180K", "nfp"), { value: 25000, units: "count" });
  assert.deepEqual(calculateEventSurprise("205,000 jobs", "180K", "nfp"), { value: 25000, units: "count" });
  assert.deepEqual(calculateEventSurprise("2.9%", "2.8%", "cpi"), { value: 0.1, units: "percentage_points" });
  for (const [a, c] of [["Hold at 3.50–3.75%", "Hold"], ["205K", "2.8%"], ["3% YoY", "2.8% YoY"], ["~205K", "180K"]]) assert.equal(calculateEventSurprise(a, c, "nfp"), null);
  assert.equal(calculateEventSurprise("4.5", "4.0", "earnings"), null);
  const released = calendar([event({ actual: "205K" })]); assert.equal(released.events[0].consensus, "180K"); assert.equal(released.events[0].surprise?.value, 25000);
});
test("malformed events are omitted; missing optional fields and invalid time/link remain safe", () => {
  const result = calendar([event({ consensus: undefined, prior: undefined, actual: undefined, time_utc: "invalid", url: "javascript:alert(1)" }), { date: "bad" }]);
  assert.equal(result.events.length, 1); assert.equal(result.events[0].timeUtc, null); assert.equal(result.events[0].sourceUrl, null); assert.equal(result.events[0].consensus, null); assert.ok(result.warnings.length);
  assert.throws(() => calendar([{ date: "bad" }]), /invalid/); assert.throws(() => calendar([event({ impact: "critical" })]), /invalid/);
  assert.equal(safeEventUrl("http://example.com"), null); assert.equal(safeEventUrl("https://user:password@example.com"), null);
});
test("classification includes 13 priority US families and contextual central banks without foreign CPI", () => {
  for (const name of ["FOMC Rate Decision", "US CPI", "US Core PCE", "US Nonfarm Payrolls", "US Unemployment", "US Average Hourly Earnings", "US Initial Jobless Claims", "US GDP", "US PPI", "US Retail Sales", "ISM Services PMI", "JOLTS", "ADP Employment Report"]) assert.ok(classifyGoldEvent(name, name), name);
  assert.equal(classifyGoldEvent("Canada CPI", "Canada CPI"), null); assert.equal(classifyGoldEvent("CPI", "CPI"), null);
  assert.equal(classifyGoldEvent("ECB Rate Decision", "ECB Rate Decision")?.relevance, "major_central_bank");
  assert.equal(classifyGoldEvent("Bank of England Rate Decision", "Bank of England Rate Decision")?.relevance, "major_central_bank");
});
test("daily risk has transparent categories; NFP/FOMC or multiple high events are very high", () => {
  assert.equal(calendar([event()]).dailyRisk[4].risk, "very_high");
  assert.equal(calendar([event({ name: "CPI", title: "US CPI" })]).dailyRisk[4].risk, "high");
  assert.equal(calendar([event({ name: "CPI", title: "US CPI", impact: "medium" })]).dailyRisk[4].risk, "medium");
  assert.equal(calendar([event({ name: "CPI", title: "US CPI" }), event({ name: "PCE", title: "US PCE" })]).dailyRisk[4].risk, "very_high");
  assert.equal(calendar([event({ name: "FOMC Decision", title: "FOMC Rate Decision" })]).eventRisk, "very_high");
});
test("date bounds, real dates and UTC offsets are validated; ET display uses DST", async () => {
  assert.throws(() => normalizeFinanceCalendar({ from: "2026-10-04", to, events: [] }, from, to), /invalid/);
  await assert.rejects(getFinanceCalendar("2026-02-30", to), /invalid/);
  await assert.rejects(getFinanceCalendar("2026-01-01", "2026-04-05"), /invalid/);
  const result = calendar([event(), event({ date: "2026-10-10" })]); assert.equal(result.events.length, 1);
  const html = renderToStaticMarkup(createElement(EconomicCalendarSection, { calendar: result }));
  assert.ok(html.includes("08:30 ET")); assert.ok(html.includes('href="https://www.financecalendar.com/"')); assert.ok(html.includes("Economic calendar data provided by"));
  const winter = normalizeFinanceCalendar({ from: "2026-12-07", to: "2026-12-11", events: [event({ date: "2026-12-11", time_utc: "2026-12-11T13:30:00+00:00" })] }, "2026-12-07", "2026-12-11", new Date("2026-12-07"));
  assert.ok(renderToStaticMarkup(createElement(EconomicCalendarSection, { calendar: winter })).includes("08:30 ET"));
});
test("network, timeout, invalid JSON and quota errors are safe with conservative retries", async () => {
  for (const fetcher of [async () => new Response("{}", { status: 503 }), async () => { throw new DOMException("Timeout", "TimeoutError"); }, async () => new Response("bad json"), async () => new Response("{}", { status: 429 })]) {
    let calls = 0; await assert.rejects(getFinanceCalendar(from, to, async () => { calls++; return fetcher(); }, now), /FinanceCalendar/); assert.ok(calls <= 2);
  }
});
test("weighted completeness changes from real coverage, retaining news/Fed gaps and stale penalties", () => {
  const none = calculateDataQuality(null, {}, null, [], now);
  const partial = calculateDataQuality(null, {}, null, [], now, calendar([event(), event({ title: "US CPI", name: "CPI", consensus: null })]));
  const full = calculateDataQuality(null, {}, null, [], now, calendar([event()]));
  assert.ok(none.completeness < partial.completeness); assert.ok(partial.completeness < full.completeness);
  for (const quality of [none, partial, full]) { assert.ok(quality.missingData.includes("Live news feed")); assert.ok(quality.missingData.includes("Market-implied Fed probabilities")); assert.ok(quality.completeness < 100); assert.equal(quality.categories?.reduce((sum, category) => sum + category.weight, 0), 100); }
  assert.equal(calculateDataQuality(null, {}, null, [], now, null, true).categories?.find(row => row.name === "Upcoming economic calendar")?.status, "ERROR");
  assert.equal(calculateDataQuality(null, {}, null, [], new Date(now.getTime() + 3600000), calendar([])).categories?.find(row => row.name === "Upcoming economic calendar")?.status, "STALE");
});
test("calendar failure is nonfatal; OpenAI receives one compact saved calendar and snapshots stay immutable", async () => {
  const date = new Date(); const day = isoDay(date); const week = tradingWeek(date);
  const gold = normalizeGold({ price: 100, observationDate: day }, [{ date: day, value: 100 }], [], date);
  const macro = Object.fromEntries(FRED_SERIES.map(config => [config.key, normalizeFred(config, [{ date: day, value: 3 }], date)]));
  const providers = { gold: async () => gold, macro: async () => macro, cot: async () => { throw new Error("unavailable"); }, calendar: async () => { throw new Error("timeout"); } };
  const failed = await collectSnapshot(providers); assert.equal(failed.economicCalendar, null); assert.ok(failed.dataQuality.warnings.some(value => value.includes("FinanceCalendar")));
  const raw = { from: week.start, to: week.end, events: [event({ date: week.end, time_utc: null, consensus: null })] };
  const original = normalizeFinanceCalendar(raw, week.start, week.end, date);
  const snapshot = await collectSnapshot({ ...providers, calendar: async (start, end) => { assert.equal(start, week.start); assert.equal(end, week.end); return original; } });
  const persisted = JSON.stringify(snapshot); const request = analysisRequest(snapshot);
  const input = JSON.parse(request.input[1].content); assert.equal(input.snapshot.economicCalendar.events[0].consensus, null);
  assert.ok(request.input[0].content.includes("Never invent, estimate, or infer a missing consensus"));
  assert.ok(request.input[0].content.includes("CURRENT FUNDAMENTAL BIAS"));
  raw.events[0].consensus = "180K"; const refreshed = normalizeFinanceCalendar(raw, week.start, week.end, date);
  assert.equal(refreshed.events[0].consensus, "180K"); assert.equal(JSON.stringify(snapshot), persisted);
});
test("calendar input stays compact when the provider returns many relevant events", () => {
  const result = calendar(Array.from({ length: 40 }, (_, index) => event({ title: `US CPI ${index}`, name: "CPI" })));
  assert.equal(result.events.length, 24); assert.ok(result.warnings.some(value => value.includes("24 priority")));
});
test("cached consensus coverage is recalculated at analysis time without assuming a delayed actual", () => {
  const result = calendar([event()]);
  const later = calculateConsensusCoverage(result.events, new Date("2026-10-09T12:31:00Z"));
  assert.equal(later.eligible, 0); assert.equal(later.percent, null);
  assert.equal(result.consensusCoverage.eligible, 1); assert.equal(result.events[0].actual, null);
});
