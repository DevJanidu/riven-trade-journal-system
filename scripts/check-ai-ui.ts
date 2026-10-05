import { config } from "dotenv";
import { readFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";
import { z } from "zod";
import { createSessionToken } from "../lib/auth/token";
import { saveGoldAnalysis } from "../lib/data/gold-analyses";
import { goldWeeklyAnalysisSchema, technicalContextSchema } from "../lib/ai/schemas";
import type { GoldAnalysisSnapshot } from "../lib/market-data/types";
import { checkAiBrowser } from "./check-ai-browser";
config({ path: ".env.development.local", quiet: true }); config({ path: ".env", quiet: true });
async function main() {
  const raw = JSON.parse(await readFile(".ai-artifacts/live-analysis.json", "utf8")) as { snapshot: GoldAnalysisSnapshot; analysis: unknown; context: unknown };
  const interpretation = z.record(z.string(), z.unknown()).parse(raw.analysis);
  delete interpretation.dataQuality;
  const analysis = { ...goldWeeklyAnalysisSchema.parse(interpretation), dataQuality: raw.snapshot.dataQuality };
  const context = technicalContextSchema.parse(raw.context);
  const client = neon(z.string().parse(process.env.DATABASE_URL));
  const [user] = await client`INSERT INTO users (name, email, password_hash) VALUES ('AI browser test', ${`ai-browser-${crypto.randomUUID()}@example.invalid`}, 'test-no-login') RETURNING id`;
  try {
    const saved = await saveGoldAnalysis(String(user.id), raw.snapshot, analysis, context, "gpt-6-luna");
    await checkAiBrowser(process.env.TEST_BASE_URL ?? "http://localhost:3000", await createSessionToken(String(user.id), "test-no-login"), saved.id);
  } finally {
    await client`DELETE FROM users WHERE id = ${user.id}`;
    console.info("Temporary browser-test account and copied live report removed. No OpenAI request used for UI testing.");
  }
}
main().catch(error => { if (error instanceof Error && !error.message.includes("sk-") && !error.message.includes("postgres")) console.error(error.message.slice(0, 300)); console.error("AI UI verification failed (no credentials printed)."); process.exitCode = 1; });
