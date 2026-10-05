import "server-only";
import { getGoldMarketData } from "./alpha-vantage";
import { cachedMarketData } from "./cache";
import { getGoldCotData } from "./cftc";
import { calculateDataQuality, hasSufficientData } from "./data-quality";
import { getFredIndicator, getFredReleaseDate } from "./fred";
import { FRED_SERIES, fredCacheSeconds } from "./fred-series";
import { isStale, tradingWeek } from "./calculations";
import { calculateConsensusCoverage, getFinanceCalendar } from "./finance-calendar";
import type { CotSnapshot, EconomicCalendarSnapshot, GoldAnalysisSnapshot, GoldMarketSnapshot, MacroIndicator } from "./types";

export interface SnapshotProviders {
  gold: () => Promise<GoldMarketSnapshot>;
  macro: () => Promise<Record<string, MacroIndicator>>;
  cot: () => Promise<CotSnapshot>;
  calendar?: (from: string, to: string) => Promise<EconomicCalendarSnapshot>;
}
export async function getMacroData(): Promise<Record<string, MacroIndicator>> {
  const results = await Promise.allSettled(FRED_SERIES.map(async config => {
    const indicator = await cachedMarketData(`fred:v1:${config.id}`, fredCacheSeconds(config.frequency), () => getFredIndicator(config));
    return [config.key, { ...indicator, stale: isStale(indicator.latestDate, config.frequency, new Date(), config.staleAfterDays) }] as const;
  }));
  const macro: Record<string, MacroIndicator> = Object.fromEntries(results.flatMap(result => result.status === "fulfilled" ? [result.value] : []));
  // Official release dates are distinct from the economic observation period.
  await Promise.allSettled(["cpi", "pce", "payrolls", "gdp"].map(async key => {
    const indicator = macro[key]; if (!indicator) return;
    indicator.releaseDate = await cachedMarketData(`fred-release:v1:${indicator.id}`, 86400, () => getFredReleaseDate(indicator.id));
  }));
  return macro;
}
export async function collectSnapshot(providers: SnapshotProviders = {
  gold: () => cachedMarketData("gold:xau:v2", 43200, () => getGoldMarketData()),
  macro: getMacroData,
  cot: () => cachedMarketData("cot:088691:v1", 43200, () => getGoldCotData()),
  calendar: (from, to) => cachedMarketData(`finance-calendar:v1:${from}:${to}`, 300, () => getFinanceCalendar(from, to)),
}): Promise<GoldAnalysisSnapshot> {
  const now = new Date();
  const week = tradingWeek(now);
  const [goldResult, macroResult, cotResult, calendarResult] = await Promise.allSettled([providers.gold(), providers.macro(), providers.cot(), providers.calendar ? providers.calendar(week.start, week.end) : Promise.resolve(null)]);
  const calendar = calendarResult.status === "fulfilled" ? calendarResult.value : null;
  const economicCalendar = calendar ? { ...calendar, consensusCoverage: calculateConsensusCoverage(calendar.events, now) } : null;
  const gold = goldResult.status === "fulfilled" ? goldResult.value : null;
  const macro = macroResult.status === "fulfilled" ? macroResult.value : {};
  const positioning = cotResult.status === "fulfilled" ? { ...cotResult.value, stale: isStale(cotResult.value.reportDate, "weekly", now) } : null;
  const failures = [goldResult.status === "rejected" ? "Gold market data unavailable." : "", macroResult.status === "rejected" ? "FRED macro data unavailable." : "", cotResult.status === "rejected" ? "CFTC positioning unavailable." : "", calendarResult.status === "rejected" ? "FinanceCalendar could not be reached or validated." : ""].filter(Boolean);
  if (!hasSufficientData(gold, macro)) throw new Error("Insufficient current Gold and macro data. Need a recent Gold price, at least two Treasury/real-yield series, and six fresh macro indicators.");
  return { analysisDate: now.toISOString(), weekStart: week.start, weekEnd: week.end, gold, macro, positioning,
    news: null, fedMarketProbabilities: null, economicCalendar,
    dataQuality: calculateDataQuality(gold, macro, positioning, failures, now, economicCalendar, calendarResult.status === "rejected") };
}
