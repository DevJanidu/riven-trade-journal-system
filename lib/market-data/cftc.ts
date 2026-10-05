import "server-only";
import { z } from "zod";
import { isStale, isoDay, numeric, validDay } from "./calculations";
import { fetchProviderJson, ProviderError } from "./http";
import type { CotSnapshot } from "./types";

export const CFTC_DATASET = "72hh-3qpy";
export const CFTC_GOLD_CONTRACT = "088691";
const rowSchema = z.object({
  cftc_contract_market_code: z.literal(CFTC_GOLD_CONTRACT), market_and_exchange_names: z.string(),
  report_date_as_yyyy_mm_dd: z.string(), m_money_positions_long_all: z.string(), m_money_positions_short_all: z.string(),
});
export function normalizeCot(raw: unknown, now = new Date()): CotSnapshot {
  const parsed = z.array(rowSchema).safeParse(raw);
  if (!parsed.success) throw new ProviderError("CFTC", "invalid");
  const rows = parsed.data.flatMap(row => {
    const date = row.report_date_as_yyyy_mm_dd.slice(0, 10);
    const long = numeric(row.m_money_positions_long_all); const short = numeric(row.m_money_positions_short_all);
    if (!validDay(date) || date > isoDay(now) || !row.market_and_exchange_names.startsWith("GOLD - ") || long === null || short === null || long < 0 || short < 0 || !Number.isInteger(long) || !Number.isInteger(short)) return [];
    return [{ date, long, short, net: long - short }];
  }).sort((a, b) => b.date.localeCompare(a.date));
  if (!rows[0]) throw new ProviderError("CFTC", "unavailable");
  const current = rows[0]; const previous = rows[1];
  const weekly = previous && Date.parse(current.date) - Date.parse(previous.date) === 7 * 86400000;
  return { reportDate: current.date, previousReportDate: previous?.date ?? null, long: current.long, short: current.short, net: current.net,
    weeklyNetChange: weekly ? current.net - previous.net : null, fetchedAt: now.toISOString(), source: "CFTC",
    sourceUrl: "https://publicreporting.cftc.gov/d/72hh-3qpy", contractCode: CFTC_GOLD_CONTRACT,
    category: "Managed Money", reportType: "Disaggregated futures only", stale: isStale(current.date, "weekly", now) };
}
export async function getGoldCotData(fetcher: typeof fetch = fetch) {
  const url = new URL(`https://publicreporting.cftc.gov/resource/${CFTC_DATASET}.json`);
  url.search = new URLSearchParams({ "$where": `cftc_contract_market_code='${CFTC_GOLD_CONTRACT}'`, "$order": "report_date_as_yyyy_mm_dd DESC", "$limit": "2", "$select": "cftc_contract_market_code,market_and_exchange_names,report_date_as_yyyy_mm_dd,m_money_positions_long_all,m_money_positions_short_all" }).toString();
  return normalizeCot(await fetchProviderJson(url, "CFTC", fetcher));
}
