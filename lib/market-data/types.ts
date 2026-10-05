export type Frequency = "daily" | "weekly" | "monthly" | "quarterly";
export interface Observation { date: string; value: number }
export interface GoldMarketSnapshot {
  symbol: "XAU"; latestPrice: number | null; observationDate: string | null;
  previousClose: number | null; previousCloseDate: string | null;
  weeklyOpen: null; weeklyHigh: null; weeklyLow: null;
  weeklyStartingClose: number | null; weeklyClosingPrice: number | null;
  weeklyCloseHigh: number | null; weeklyCloseLow: number | null;
  weeklyChangePercent: number | null; fourWeekChangePercent: number | null;
  historyDate: string | null; historyWeekStart: string | null; historyWeekEnd: string | null;
  fetchedAt: string; source: "Alpha Vantage"; warnings: string[];
}
export interface MacroIndicator {
  id: string; name: string; latestValue: number | null; previousValue: number | null;
  latestDate: string | null; previousDate: string | null; change: number | null; changePercent: number | null;
  changeBps: number | null; momPercent: number | null; yoyPercent: number | null;
  payrollChangePersons: number | null; previousPayrollChangePersons: number | null;
  frequency: Frequency; units: string; comparison: string; seasonalAdjustment: string;
  source: "FRED"; sourceUrl: string; fetchedAt: string; stale: boolean; forecast: null;
  releaseDate: string | null; warnings: string[];
}
export interface CotSnapshot {
  reportDate: string; previousReportDate: string | null; long: number; short: number; net: number;
  weeklyNetChange: number | null; fetchedAt: string; source: "CFTC"; sourceUrl: string;
  contractCode: "088691"; category: "Managed Money"; reportType: "Disaggregated futures only"; stale: boolean;
}
export type Availability = "AVAILABLE" | "PARTIAL" | "MISSING" | "STALE" | "ERROR";
export interface QualityCategory { name: string; weight: number; status: Availability; coverage: number; detail: string }
export interface DataQuality { completeness: number; missingData: string[]; staleData: string[]; warnings: string[]; confidenceCap: number; categories?: QualityCategory[] }
export type EconomicImpact = "high" | "medium" | "low";
export type EventRisk = "low" | "medium" | "high" | "very_high";
export interface EconomicEvent {
  date: string; timeUtc: string | null; timeEt: string | null; allDay: boolean;
  name: string; title: string; category: string | null; impact: EconomicImpact;
  prior: string | null; consensus: string | null; actual: string | null;
  source: "FinanceCalendar"; sourceUrl: string | null; fetchedAt: string;
  relevance: "us_priority" | "major_central_bank"; series: string;
  surprise: { value: number; units: "percentage_points" | "count" | "index_points" } | null;
}
export interface EconomicCalendarSnapshot {
  source: "FinanceCalendar"; sourceUrl: string; fetchedAt: string;
  week: { from: string; to: string }; events: EconomicEvent[];
  dailyRisk: { date: string; risk: EventRisk }[]; eventRisk: EventRisk;
  consensusCoverage: { eligible: number; available: number; percent: number | null; highImpactEligible: number; highImpactAvailable: number };
  warnings: string[];
}
export interface EconomicCalendarProvider { getEvents(start: Date, end: Date): Promise<EconomicEvent[]> }
export interface NewsItem { title: string; publishedAt: string; source: string; url: string }
export interface NewsProvider { getNews(start: Date, end: Date): Promise<NewsItem[]> }
export interface GoldAnalysisSnapshot {
  analysisDate: string; weekStart: string; weekEnd: string; gold: GoldMarketSnapshot | null;
  macro: Record<string, MacroIndicator>; positioning: CotSnapshot | null;
  /** Legacy placeholders retained for old saved reports; new reports use economicCalendar. */
  upcomingEvents?: EconomicEvent[]; consensus?: null; news: null; fedMarketProbabilities: null;
  economicCalendar?: EconomicCalendarSnapshot | null;
  dataQuality: DataQuality;
}
