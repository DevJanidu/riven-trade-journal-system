import "server-only";
import { z } from "zod";
import { basisPointChange, daysAgo, isStale, isoDay, monthOffset, numeric, observationAtOrBefore, percentChange, round, validDay } from "./calculations";
import type { FredSeriesConfig } from "./fred-series";
import { fetchProviderJson, ProviderError } from "./http";
import type { MacroIndicator, Observation } from "./types";

const observationsSchema = z.object({ observations: z.array(z.object({ date: z.string(), value: z.string() })) });
export function parseFredObservations(raw: unknown, now = new Date()): Observation[] {
  const parsed = observationsSchema.safeParse(raw);
  if (!parsed.success) throw new ProviderError("FRED", "invalid");
  return parsed.data.observations.flatMap(row => {
    const value = numeric(row.value);
    return value !== null && validDay(row.date) && row.date <= isoDay(now) ? [{ date: row.date, value }] : [];
  }).sort((a, b) => b.date.localeCompare(a.date));
}
export function normalizeFred(config: FredSeriesConfig, observations: Observation[], now = new Date()): MacroIndicator {
  const latest = observations[0] ?? null;
  const target = latest ? config.frequency === "daily" ? daysAgo(latest.date, 7) : config.frequency === "weekly" ? daysAgo(latest.date, 7) : monthOffset(latest.date, config.frequency === "quarterly" ? -3 : -1) : null;
  const previous = target ? observationAtOrBefore(observations, target, config.frequency === "daily" ? 4 : config.frequency === "weekly" ? 0 : 0) : null;
  const yearAgo = latest && config.frequency === "monthly" ? observations.find(row => row.date === monthOffset(latest.date, -12)) ?? null : null;
  const previousMonth = previous && config.key === "payrolls" ? observations.find(row => row.date === monthOffset(previous.date, -1)) : null;
  const change = latest && previous ? round(latest.value - previous.value) : null;
  return {
    id: config.id, name: config.name, latestValue: latest?.value ?? null, previousValue: previous?.value ?? null,
    latestDate: latest?.date ?? null, previousDate: previous?.date ?? null, change,
    changePercent: config.kind === "rate" || config.kind === "growth" ? null : percentChange(latest?.value ?? null, previous?.value ?? null),
    changeBps: config.kind === "rate" && config.frequency === "daily" ? basisPointChange(latest?.value ?? null, previous?.value ?? null) : null,
    momPercent: config.frequency === "monthly" && config.kind !== "rate" ? percentChange(latest?.value ?? null, previous?.value ?? null) : null,
    yoyPercent: config.frequency === "monthly" && config.kind !== "rate" ? percentChange(latest?.value ?? null, yearAgo?.value ?? null) : null,
    payrollChangePersons: config.key === "payrolls" && change !== null ? Math.round(change * 1000) : null,
    previousPayrollChangePersons: previous && previousMonth ? Math.round((previous.value - previousMonth.value) * 1000) : null,
    frequency: config.frequency, units: config.units, comparison: config.frequency === "daily" ? "Latest versus approximately one week earlier" : `Latest versus preceding ${config.frequency === "weekly" ? "week" : config.frequency === "monthly" ? "month" : "quarter"}`,
    seasonalAdjustment: config.seasonalAdjustment, source: "FRED", sourceUrl: `https://fred.stlouisfed.org/series/${config.id}`,
    fetchedAt: now.toISOString(), stale: isStale(latest?.date ?? null, config.frequency, now, config.staleAfterDays), forecast: null, releaseDate: null,
    warnings: config.inflation ? ["MoM and YoY calculated from seasonally adjusted price indexes; may differ from headline unadjusted YoY releases."] : config.key === "usdBroad" ? ["Daily USD observations are published weekly in the Federal Reserve H.10 release; a normal publication lag is allowed."] : [],
  };
}
export async function fredRequest(path: string, params: Record<string, string>, fetcher: typeof fetch = fetch) {
  const key = process.env.FRED_API_KEY;
  if (!key) throw new ProviderError("FRED", "configuration");
  const url = new URL(`https://api.stlouisfed.org/fred/${path}`);
  url.search = new URLSearchParams({ ...params, api_key: key, file_type: "json" }).toString();
  return fetchProviderJson(url, "FRED", fetcher);
}
export async function getFredIndicator(config: FredSeriesConfig, fetcher: typeof fetch = fetch) {
  const limit = config.frequency === "monthly" ? "15" : config.frequency === "quarterly" ? "4" : "45";
  const raw = await fredRequest("series/observations", { series_id: config.id, sort_order: "desc", limit, observation_end: isoDay(new Date()) }, fetcher);
  return normalizeFred(config, parseFredObservations(raw));
}
export async function getFredReleaseDate(id: string): Promise<string | null> {
  const raw = await fredRequest("series/release", { series_id: id });
  const releases = z.object({ releases: z.array(z.object({ id: z.number() })) }).parse(raw);
  if (!releases.releases[0]) return null;
  const dates = await fredRequest("release/dates", { release_id: String(releases.releases[0].id), sort_order: "desc", limit: "10", include_release_dates_with_no_data: "false" });
  return z.object({ release_dates: z.array(z.object({ date: z.string() })) }).parse(dates).release_dates.find(item => validDay(item.date) && item.date <= isoDay(new Date()))?.date ?? null;
}
