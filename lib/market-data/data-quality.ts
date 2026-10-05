import { FRED_SERIES } from "./fred-series";
import { isStale } from "./calculations";
import type { CotSnapshot, DataQuality, EconomicCalendarSnapshot, GoldMarketSnapshot, MacroIndicator, QualityCategory } from "./types";

export function calculateDataQuality(gold: GoldMarketSnapshot | null, macro: Record<string, MacroIndicator>, cot: CotSnapshot | null, failures: string[], now = new Date(), calendar: EconomicCalendarSnapshot | null = null, calendarError = false): DataQuality {
  const missingData = ["Live news feed", "Market-implied Fed probabilities"];
  const staleData: string[] = [];
  if (gold?.latestPrice === null || !gold) missingData.push("Gold price");
  if (!gold?.historyDate) missingData.push("Gold historical closes");
  if (gold && isStale(gold.observationDate, "daily", now)) staleData.push("Gold price");
  if (gold?.historyDate && isStale(gold.historyDate, "daily", now)) staleData.push("Gold historical closes");
  for (const config of FRED_SERIES) {
    const indicator = macro[config.key];
    if (!indicator || indicator.latestValue === null) missingData.push(config.name);
    else if (isStale(indicator.latestDate, indicator.frequency, now, config.staleAfterDays)) staleData.push(config.name);
  }
  if (!cot) missingData.push("Gold CFTC positioning"); else if (cot.stale) staleData.push("Gold CFTC positioning");
  const categories: QualityCategory[] = [];
  const add = (name: string, weight: number, values: { present: boolean; stale: boolean }[]) => {
    const present = values.filter(value => value.present).length;
    const stale = values.some(value => value.present && value.stale);
    const coverage = values.reduce((sum, value) => sum + (value.present ? value.stale ? 0.5 : 1 : 0), 0) / values.length;
    categories.push({ name, weight, coverage, status: !present ? "MISSING" : stale ? "STALE" : present < values.length ? "PARTIAL" : "AVAILABLE", detail: `${present}/${values.length} observations available${stale ? "; stale observations receive half credit" : ""}` });
  };
  add("Gold market data", 15, [{ present: gold?.latestPrice != null, stale: staleData.includes("Gold price") }, { present: !!gold?.historyDate, stale: staleData.includes("Gold historical closes") }]);
  const macroGroup = (name: string, weight: number, keys: string[]) => add(name, weight, keys.map(key => ({ present: macro[key]?.latestValue != null, stale: !!macro[key]?.stale })));
  macroGroup("Treasury yields", 12, ["us2y", "us10y"]); macroGroup("Real yields", 15, ["realYield10y"]);
  macroGroup("Inflation", 12, ["cpi", "coreCpi", "pce", "corePce"]);
  macroGroup("Labor", 12, ["payrolls", "unemployment", "joblessClaims", "averageHourlyEarnings"]);
  macroGroup("Fed / current rates", 6, ["effectiveFedFundsRate"]);
  macroGroup("Growth and USD proxy", 6, ["gdp", "retailSales", "industrialProduction", "usdBroad"]);
  add("COT positioning", 7, [{ present: !!cot, stale: !!cot?.stale }]);
  const calendarStale = !!calendar && now.getTime() - Date.parse(calendar.fetchedAt) > 15 * 60000;
  const calendarPartial = !!calendar?.warnings.length;
  categories.push({ name: "Upcoming economic calendar", weight: 6, status: calendarError ? "ERROR" : !calendar ? "MISSING" : calendarStale ? "STALE" : calendarPartial ? "PARTIAL" : "AVAILABLE", coverage: calendar ? calendarStale || calendarPartial ? 0.5 : 1 : 0, detail: calendar ? `${calendar.week.from}–${calendar.week.to}; ${calendar.events.length} relevant events` : calendarError ? "FinanceCalendar could not be reached or validated" : "Calendar data unavailable in this snapshot" });
  const consensus = calendar?.consensusCoverage;
  const consensusFraction = consensus?.eligible ? consensus.available / consensus.eligible : 0;
  categories.push({ name: "Economic consensus", weight: 5, status: calendarError ? "ERROR" : calendarStale ? "STALE" : !consensusFraction ? "MISSING" : consensusFraction < 1 ? "PARTIAL" : "AVAILABLE", coverage: consensusFraction * (calendarStale ? 0.5 : 1), detail: consensus ? `${consensus.available}/${consensus.eligible} upcoming priority US events have consensus; ${consensus.highImpactAvailable}/${consensus.highImpactEligible} high-impact events` : "Consensus data unavailable" });
  for (const name of ["Live news feed", "Market-implied Fed probabilities"]) categories.push({ name, weight: 2, status: "MISSING", coverage: 0, detail: "Provider not connected" });
  if (!calendar) missingData.push("Upcoming economic calendar");
  if (!consensusFraction) missingData.push("Economic consensus");
  if (calendarStale) staleData.push("Upcoming economic calendar", "Economic consensus");
  const completeness = Math.round(categories.reduce((sum, category) => sum + category.weight * category.coverage, 0) / categories.reduce((sum, category) => sum + category.weight, 0) * 100);
  const criticalMissing = !macro.realYield10y || macro.realYield10y.latestValue === null || macro.realYield10y.stale;
  const confidenceCap = Math.max(20, Math.min(85, completeness - staleData.length * 6, criticalMissing ? 55 : 85));
  return { completeness, missingData, staleData, confidenceCap, categories, warnings: [...new Set([
    ...failures, ...(gold?.warnings ?? []), ...(calendar?.warnings ?? []),
    ...(!consensusFraction ? ["Consensus data unavailable for upcoming priority events in this snapshot."] : consensusFraction < 1 ? ["Economic consensus coverage is partial; missing estimates must not be inferred."] : []),
    "Live news feed not connected.", ...(!calendar ? ["Upcoming calendar data unavailable in this snapshot."] : ["FinanceCalendar actuals may arrive roughly an hour after release; not a real-time execution feed.", "Scheduled event risk describes uncertainty, not Gold direction."]),
    "Market-implied Fed probability data not connected.", "Scenario percentages are evidence-based confidence estimates, not calibrated probabilities.",
    "Economic observations can be revised; this report preserves the snapshot used at generation.",
  ])] };
}
export function hasSufficientData(gold: GoldMarketSnapshot | null, macro: Record<string, MacroIndicator>) {
  const rates = ["us2y", "us10y", "realYield10y"].filter(key => macro[key]?.latestValue !== null && macro[key]?.latestValue !== undefined && !macro[key].stale);
  const available = Object.values(macro).filter(row => row.latestValue !== null && !row.stale);
  return !!gold && gold.latestPrice !== null && !isStale(gold.observationDate, "daily") && rates.length >= 2 && available.length >= 6;
}
