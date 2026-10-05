import assert from "node:assert/strict";
import { config } from "dotenv";
import { readFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";
import ExcelJS from "exceljs";
import { z } from "zod";
import { getDb } from "../lib/db";
import { trades } from "../lib/db/schema";
import { goldWeeklyAnalysisSchema, technicalContextSchema } from "../lib/ai/schemas";
import type { GoldAnalysisSnapshot } from "../lib/market-data/types";
import { getAnalysisHistoryCount, saveGoldAnalysis } from "../lib/data/gold-analyses";
import { createSessionToken, sessionCookieName } from "../lib/auth/token";
import { checkAiBrowser } from "./check-ai-browser";

config({ path: ".env.development.local", quiet: true }); config({ path: ".env", quiet: true });
async function main() {
  const raw = JSON.parse(await readFile(".ai-artifacts/finance-calendar-analysis.json", "utf8")) as { snapshot: GoldAnalysisSnapshot; analysis: unknown };
  const interpretation = z.record(z.string(), z.unknown()).parse(raw.analysis); delete interpretation.dataQuality;
  const analysis = { ...goldWeeklyAnalysisSchema.parse(interpretation), dataQuality: raw.snapshot.dataQuality };
  const client = neon(z.string().parse(process.env.DATABASE_URL));
  const [user] = await client`INSERT INTO users (name, email, password_hash) VALUES ('Pagination test', ${`pagination-${crypto.randomUUID()}@example.invalid`}, 'test-no-login') RETURNING id`;
  const userId = String(user.id);
  try {
    const context = technicalContextSchema.parse({});
    const first = await saveGoldAnalysis(userId, raw.snapshot, analysis, context, "gpt-6-luna");
    for (let index = 0; index < 11; index++) await saveGoldAnalysis(userId, raw.snapshot, analysis, context, "gpt-6-luna");
    assert.equal(await getAnalysisHistoryCount(userId), 12);
    await getDb().insert(trades).values(Array.from({ length: 23 }, (_, index) => ({
      userId, date: `2026-10-${String(index + 1).padStart(2, "0")}`, instrument: "XAUUSD", session: "London" as const,
      direction: "Long" as const, entry: "100", stopLoss: "90", takeProfit: "120", riskAmount: "50", plannedRR: "2", actualR: "2", profitLoss: "100",
      result: "Win" as const, setup: `Pagination test setup ${index % 7 + 1}`, followedRules: true, emotion: "Calm" as const,
      entryReason: "Synthetic pagination fixture, removed after verification.",
    })));
    const base = process.env.TEST_BASE_URL ?? "http://localhost:3000";
    const token = await createSessionToken(userId, "test-no-login");
    await checkAiBrowser(base, token, first.id, true, true);
    const exported = await fetch(`${base}/api/reports/export?period=yearly&date=2026-10-05`, { headers: { Cookie: `${sessionCookieName}=${token}` } });
    assert.equal(exported.status, 200);
    const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(await exported.arrayBuffer());
    assert.equal(workbook.getWorksheet("Trades")?.rowCount, 24, "Excel includes all 23 trades plus header");
    assert.equal(workbook.getWorksheet("Setup Breakdown")?.rowCount, 8, "Excel includes all seven setups plus header");
    console.info("Excel exports include the entire selected period regardless of table page. No OpenAI requests made.");
  } finally {
    await client`DELETE FROM users WHERE id = ${userId}`;
    console.info("Temporary pagination account, trades and reports removed.");
  }
}
main().catch(error => { if (error instanceof assert.AssertionError) console.error(error.message.slice(0, 250)); console.error("Pagination verification failed; no credentials printed."); process.exitCode = 1; });
