import "server-only";
import { z } from "zod";
import { daysAgo, isoDay, numeric, observationAtOrBefore, percentChange, tradingWeek, validDay } from "./calculations";
import { fetchProviderJson, ProviderError } from "./http";
import type { GoldMarketSnapshot, Observation } from "./types";

export function checkAlphaResponse(raw: unknown) {
  const obj = z.record(z.string(), z.unknown()).parse(raw);
  if (obj.Note || obj.Information) throw new ProviderError("Alpha Vantage", "rate_limit");
  if (obj["Error Message"]) throw new ProviderError("Alpha Vantage", "invalid");
  return obj;
}
export function parseGoldSpot(raw: unknown) {
  const obj = checkAlphaResponse(raw);
  if (obj.nominal !== "XAUUSD") throw new ProviderError("Alpha Vantage", "invalid");
  const price = numeric(obj.price);
  const timestamp = typeof obj.timestamp === "string" ? obj.timestamp : "";
  const date = timestamp.slice(0, 10);
  return { price: price !== null && price > 0 ? price : null, observationDate: validDay(date) ? date : null };
}
export function parseGoldHistory(raw: unknown): Observation[] {
  const obj = checkAlphaResponse(raw);
  const rows = z.array(z.object({ date: z.string(), price: z.union([z.string(), z.number()]) })).safeParse(obj.data);
  if (!rows.success) throw new ProviderError("Alpha Vantage", "invalid");
  return rows.data.flatMap(row => { const value = numeric(row.price); return validDay(row.date) && value !== null && value > 0 ? [{ date: row.date, value }] : []; }).sort((a, b) => b.date.localeCompare(a.date));
}
export function normalizeGold(spot: ReturnType<typeof parseGoldSpot> | null, history: Observation[], warnings: string[], now = new Date()): GoldMarketSnapshot {
  const today = isoDay(now);
  // Provider daily history can contain weekend observations. The journal's
  // trading-day comparisons explicitly use Monday-Friday UTC observations.
  const rows = history.filter(row => row.date <= today && ![0, 6].includes(new Date(row.date).getUTCDay()));
  const latest = rows[0] ?? null;
  const week = latest ? tradingWeek(new Date(latest.date)) : null;
  const weekRows = week ? rows.filter(row => row.date >= week.start && row.date <= week.end) : [];
  const base = latest ? observationAtOrBefore(rows, daysAgo(latest.date, 7), 4) : null;
  const fourWeekBase = latest ? observationAtOrBefore(rows, daysAgo(latest.date, 28), 4) : null;
  const previousClose = rows.find(row => row.date < (spot?.observationDate ?? today)) ?? null;
  return {
    symbol: "XAU", latestPrice: spot?.price ?? latest?.value ?? null, observationDate: spot?.price !== null && spot?.price !== undefined ? spot.observationDate : latest?.date ?? null,
    previousClose: previousClose?.value ?? null, previousCloseDate: previousClose?.date ?? null,
    weeklyOpen: null, weeklyHigh: null, weeklyLow: null,
    weeklyStartingClose: weekRows.at(-1)?.value ?? null, weeklyClosingPrice: latest?.value ?? null,
    weeklyCloseHigh: weekRows.length ? Math.max(...weekRows.map(row => row.value)) : null,
    weeklyCloseLow: weekRows.length ? Math.min(...weekRows.map(row => row.value)) : null,
    weeklyChangePercent: percentChange(latest?.value ?? null, base?.value ?? null), fourWeekChangePercent: percentChange(latest?.value ?? null, fourWeekBase?.value ?? null),
    historyDate: latest?.date ?? null, historyWeekStart: week?.start ?? null, historyWeekEnd: week?.end ?? null,
    fetchedAt: now.toISOString(), source: "Alpha Vantage",
    warnings: [...warnings, "Gold history provides daily closes. True weekly open/high/low unavailable; close range is not an intraday range.", "Gold trading-day comparisons use Monday-Friday UTC dates and exclude provider weekend observations."],
  };
}
export async function getGoldMarketData(fetcher: typeof fetch = fetch): Promise<GoldMarketSnapshot> {
  const key = process.env.ALPHA_VANTAGE_API_KEY;
  if (!key) throw new ProviderError("Alpha Vantage", "configuration");
  async function request(fn: string) {
    const url = new URL("https://www.alphavantage.co/query");
    url.search = new URLSearchParams({ function: fn, symbol: "XAU", apikey: key!, ...(fn.endsWith("HISTORY") ? { interval: "daily" } : {}) }).toString();
    return fetchProviderJson(url, "Alpha Vantage", fetcher);
  }
  const warnings: string[] = [];
  let spot: ReturnType<typeof parseGoldSpot> | null = null;
  let history: Observation[] = [];
  try { spot = parseGoldSpot(await request("GOLD_SILVER_SPOT")); } catch { warnings.push("Gold spot unavailable."); }
  // The free tier limits requests to one per second. No quota response is retried.
  await new Promise(resolve => setTimeout(resolve, 1200));
  try { history = parseGoldHistory(await request("GOLD_SILVER_HISTORY")); } catch { warnings.push("Gold historical closes unavailable."); }
  if (!spot?.price && !history.length) throw new ProviderError("Alpha Vantage", "unavailable");
  return normalizeGold(spot, history, warnings);
}
