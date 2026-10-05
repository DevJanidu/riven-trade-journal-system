import { config } from "dotenv";
import OpenAI from "openai";
import { collectSnapshot } from "../lib/market-data/snapshot";
import { FRED_SERIES } from "../lib/market-data/fred-series";
import { fredRequest } from "../lib/market-data/fred";
import { goldAnalysisModel } from "../lib/ai/gold-analysis";

config({ path: ".env.development.local", quiet: true }); config({ path: ".env", quiet: true });
async function main() {
  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 0, timeout: 20000 });
    const model = await client.models.retrieve(goldAnalysisModel());
    console.info(`OpenAI model access: ${model.id}. No analysis request made.`);
  } catch { console.info("OpenAI model access: unavailable or key not configured. No model substitution."); }
  for (const series of FRED_SERIES) {
    try {
      const metadata = await fredRequest("series", { series_id: series.id });
      const parsed = metadata as { seriess?: Array<{ id: string; title: string; frequency: string; units: string }> };
      console.info("FRED metadata", JSON.stringify(parsed.seriess?.[0] ? { id: parsed.seriess[0].id, title: parsed.seriess[0].title, frequency: parsed.seriess[0].frequency, units: parsed.seriess[0].units } : { id: series.id, status: "unavailable" }));
    } catch { console.info(`FRED ${series.id}: unavailable`); }
  }
  const snapshot = await collectSnapshot();
  console.info(JSON.stringify({ gold: snapshot.gold, macro: Object.fromEntries(Object.entries(snapshot.macro).map(([key, row]) => [key, { value: row.latestValue, date: row.latestDate, change: row.change, changeBps: row.changeBps, mom: row.momPercent, yoy: row.yoyPercent, payrollChangePersons: row.payrollChangePersons, stale: row.stale, releaseDate: row.releaseDate }])), cot: snapshot.positioning, quality: snapshot.dataQuality }, null, 2));
}
main().catch(() => { console.error("Provider check failed: insufficient data or server configuration unavailable. No secrets printed."); process.exitCode = 1; });
