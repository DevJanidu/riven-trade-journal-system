import "server-only";
import { z } from "zod";
import { fetchProviderJson, ProviderError } from "./http";
import type { EconomicCalendarSnapshot, EconomicEvent, EventRisk } from "./types";

export const FINANCE_CALENDAR_BASE_URL = "https://www.financecalendar.com/wp-json/fc/v1";
export const FINANCE_CALENDAR_SOURCE_URL = "https://www.financecalendar.com/";
const daySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
});
const text = z.string().trim().max(600).nullish();
const envelopeSchema = z.object({ from: daySchema, to: daySchema, events: z.array(z.unknown()).max(500) });
const eventSchema = z.object({
  date: daySchema, name: z.string().trim().min(1).max(200), title: z.string().trim().min(1).max(300).optional(),
  impact: z.enum(["high", "medium", "low"]), category: text, all_day: z.boolean().nullish(),
  time_utc: text, time_et: text, consensus: text, prior: text, actual: text, url: text,
});

// Recognizable US series plus explicit country metadata in the title; do not label foreign CPI as US CPI.
export const GOLD_EVENT_SERIES = [
  { series: "fomc", pattern: /\bfomc\b|federal reserve|\bfed (?:rate|decision)/i },
  { series: "cpi", pattern: /\bcpi\b|consumer price/i },
  { series: "pce", pattern: /\bpce\b|personal consumption expenditure/i },
  { series: "nfp", pattern: /non[ -]?farm|\bnfp\b|employment situation|jobs report/i },
  { series: "unemployment", pattern: /unemployment/i },
  { series: "earnings", pattern: /average hourly earnings/i },
  { series: "jobless-claims", pattern: /jobless claims|unemployment claims/i },
  { series: "gdp", pattern: /\bgdp\b|gross domestic product/i },
  { series: "ppi", pattern: /\bppi\b|producer price/i },
  { series: "retail-sales", pattern: /retail sales/i },
  { series: "ism", pattern: /\bism\b|institute for supply management/i },
  { series: "jolts", pattern: /\bjolts\b|job openings/i },
  { series: "adp", pattern: /\badp\b/i },
] as const;
export function classifyGoldEvent(name: string, title: string): { series: string; relevance: EconomicEvent["relevance"] } | null {
  const label = `${name} ${title}`;
  const foreign = /\b(?:canada|canadian|eurozone|euro area|uk|united kingdom|british|japan|japanese|australia|australian|china|chinese|germany|german|france|french|new zealand|switzerland|swiss)\b/i.test(label);
  const us = /\b(?:us|u\.s\.|usa|united states|american)\b/i.test(label);
  const match = GOLD_EVENT_SERIES.find(item => item.pattern.test(label));
  const inherentlyUs = match && ["fomc", "nfp", "ism", "jolts", "adp"].includes(match.series);
  if (match && !foreign && (us || inherentlyUs)) return { series: match.series, relevance: "us_priority" };
  if (/\b(?:ecb|boe|boj|boc|rba|rbnz|snb)\b|european central bank|bank of (?:england|japan|canada)|reserve bank of (?:australia|new zealand)|swiss national bank/i.test(label) && /decision|rate|policy/i.test(label)) {
    return { series: "central-bank", relevance: "major_central_bank" };
  }
  return null;
}
export function safeEventUrl(value: string | null | undefined): string | null {
  try { const url = new URL(value ?? ""); return url.protocol === "https:" && !url.username && !url.password ? url.href : null; } catch { return null; }
}
function parseComparable(value: string): { value: number; unit: "percent" | "count" | "plain" } | null {
  const match = value.trim().match(/^([+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s*([KMB%])?\s*(jobs|claims)?$/i);
  if (!match || (match[2] === "%" && match[3])) return null;
  const suffix = match[2]?.toUpperCase();
  const multiplier = suffix === "K" ? 1000 : suffix === "M" ? 1000000 : suffix === "B" ? 1000000000 : 1;
  const number = Number(match[1].replaceAll(",", "")) * multiplier;
  return Number.isFinite(number) ? { value: number, unit: suffix === "%" ? "percent" : suffix || match[3] ? "count" : "plain" } : null;
}
export function calculateEventSurprise(actual: string | null, consensus: string | null, series: string): EconomicEvent["surprise"] {
  if (!actual || !consensus || series === "fomc" || series === "central-bank") return null;
  const a = parseComparable(actual); const c = parseComparable(consensus);
  if (!a || !c) return null;
  const countSeries = ["nfp", "jobless-claims", "jolts", "adp"].includes(series);
  if (a.unit !== c.unit && !(countSeries && a.unit !== "percent" && c.unit !== "percent")) return null;
  if (a.unit === "plain" && !countSeries && series !== "ism") return null;
  return { value: Number((a.value - c.value).toFixed(6)), units: a.unit === "percent" ? "percentage_points" : countSeries || a.unit === "count" ? "count" : "index_points" };
}
const riskRank: Record<EventRisk, number> = { low: 0, medium: 1, high: 2, very_high: 3 };
export function calculateConsensusCoverage(events: EconomicEvent[], now = new Date()): EconomicCalendarSnapshot["consensusCoverage"] {
  const upcoming = events.filter(event => event.actual === null && (event.timeUtc ? Date.parse(event.timeUtc) >= now.getTime() : event.date >= now.toISOString().slice(0, 10)));
  const eligible = upcoming.filter(event => event.relevance === "us_priority");
  const available = eligible.filter(event => event.consensus !== null).length;
  const high = eligible.filter(event => event.impact === "high");
  return { eligible: eligible.length, available, percent: eligible.length ? Math.round(available / eligible.length * 100) : null, highImpactEligible: high.length, highImpactAvailable: high.filter(event => event.consensus !== null).length };
}
export function dailyEventRisk(events: EconomicEvent[]): EventRisk {
  const high = events.filter(event => event.impact === "high");
  if (high.length >= 2 || high.some(event => event.series === "nfp" || (event.series === "fomc" && /decision|rate/i.test(event.title)))) return "very_high";
  return high.length ? "high" : events.some(event => event.impact === "medium") ? "medium" : "low";
}
export function normalizeFinanceCalendar(payload: unknown, from: string, to: string, now = new Date()): EconomicCalendarSnapshot {
  const parsed = envelopeSchema.safeParse(payload);
  if (!parsed.success || parsed.data.from !== from || parsed.data.to !== to) throw new ProviderError("FinanceCalendar", "invalid");
  const warnings: string[] = []; const events: EconomicEvent[] = []; const seen = new Set<string>(); let valid = 0;
  for (const raw of parsed.data.events) {
    const result = eventSchema.safeParse(raw);
    if (!result.success) { warnings.push("A malformed FinanceCalendar event was omitted."); continue; }
    const row = result.data;
    if (row.date < from || row.date > to) { warnings.push("An out-of-period FinanceCalendar event was omitted."); continue; }
    valid++;
    const title = row.title ?? row.name; const classification = classifyGoldEvent(row.name, title);
    if (!classification || row.impact === "low") continue;
    let timeUtc: string | null = null;
    if (row.time_utc) {
      const timestamp = z.iso.datetime({ offset: true }).safeParse(row.time_utc);
      if (timestamp.success && new Date(timestamp.data).toISOString().slice(0, 10) === row.date) timeUtc = new Date(timestamp.data).toISOString();
      else warnings.push("An invalid FinanceCalendar UTC timestamp was omitted.");
    }
    const timeEt = row.time_et && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(row.time_et) ? row.time_et : null;
    const key = `${row.date}:${timeUtc}:${title}`; if (seen.has(key)) continue; seen.add(key);
    const consensus = row.consensus || null; const actual = row.actual || null;
    events.push({ ...classification, date: row.date, timeUtc, timeEt, allDay: row.all_day ?? false,
      name: row.name, title, impact: row.impact, category: row.category ?? null,
      consensus, actual, prior: row.prior || null, source: "FinanceCalendar", sourceUrl: safeEventUrl(row.url),
      fetchedAt: now.toISOString(), surprise: calculateEventSurprise(actual, consensus, classification.series) });
  }
  if (parsed.data.events.length && !valid) throw new ProviderError("FinanceCalendar", "invalid");
  if (parsed.data.events.length === 500) throw new ProviderError("FinanceCalendar", "invalid"); // Cannot assert complete coverage of a capped result.
  if (events.length > 24) {
    events.sort((a, b) => Number(b.impact === "high") - Number(a.impact === "high") || Number(b.relevance === "us_priority") - Number(a.relevance === "us_priority") || a.date.localeCompare(b.date));
    events.length = 24;
    warnings.push("Calendar snapshot limited to 24 priority events; risk and consensus coverage describe only retained events.");
  }
  events.sort((a, b) => a.date.localeCompare(b.date) || (a.timeUtc ?? "").localeCompare(b.timeUtc ?? "") || a.title.localeCompare(b.title));
  const dailyRisk: EconomicCalendarSnapshot["dailyRisk"] = [];
  for (let day = new Date(`${from}T00:00:00Z`); day.toISOString().slice(0, 10) <= to; day = new Date(day.getTime() + 86400000)) {
    const date = day.toISOString().slice(0, 10); dailyRisk.push({ date, risk: dailyEventRisk(events.filter(event => event.date === date)) });
  }
  return { source: "FinanceCalendar", sourceUrl: FINANCE_CALENDAR_SOURCE_URL, fetchedAt: now.toISOString(), week: { from, to }, events,
    dailyRisk, eventRisk: dailyRisk.reduce<EventRisk>((risk, day) => riskRank[day.risk] > riskRank[risk] ? day.risk : risk, "low"),
    consensusCoverage: calculateConsensusCoverage(events, now),
    warnings: [...new Set(warnings)] };
}
export async function getFinanceCalendar(from: string, to: string, fetcher: typeof fetch = fetch, now = new Date(), impact?: "high"): Promise<EconomicCalendarSnapshot> {
  if (!daySchema.safeParse(from).success || !daySchema.safeParse(to).success || to < from || (Date.parse(to) - Date.parse(from)) / 86400000 > 91) throw new ProviderError("FinanceCalendar", "invalid");
  const url = new URL(`${FINANCE_CALENDAR_BASE_URL}/calendar`);
  url.searchParams.set("from", from); url.searchParams.set("to", to); url.searchParams.set("limit", "500");
  if (impact) url.searchParams.set("impact", impact);
  return normalizeFinanceCalendar(await fetchProviderJson(url, "FinanceCalendar", fetcher), from, to, now);
}
export const getHighImpactEvents = (from: string, to: string, fetcher: typeof fetch = fetch) => getFinanceCalendar(from, to, fetcher, new Date(), "high");
