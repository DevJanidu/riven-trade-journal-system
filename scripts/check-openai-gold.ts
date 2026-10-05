import { config } from "dotenv";
import { collectSnapshot } from "../lib/market-data/snapshot";
import OpenAI from "openai";
import { mkdir, writeFile } from "node:fs/promises";
import { analysisRequest } from "../lib/ai/gold-analysis";
import { technicalContextSchema, validateAnalysis } from "../lib/ai/schemas";
config({ path: ".env.development.local", quiet: true }); config({ path: ".env", quiet: true });
async function main() {
  const snapshot = await collectSnapshot();
  console.info("Snapshot ready", snapshot.dataQuality.completeness);
  try {
    const context = technicalContextSchema.parse({});
    const response = await new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 0, timeout: 90000 }).responses.parse(analysisRequest(snapshot));
    console.info("Responses status", response.status, response.incomplete_details, "Parsed", !!response.output_parsed);
    const analysis = validateAnalysis(response.output_parsed, snapshot.dataQuality, ["gold", "positioning", ...Object.keys(snapshot.macro)]);
    console.info("Structured response valid", { bias: analysis.bias, confidence: analysis.confidence, probabilities: analysis.probabilities });
    await mkdir(".ai-artifacts", { recursive: true });
    await writeFile(".ai-artifacts/live-analysis.json", JSON.stringify({ snapshot, analysis, context }));
  } catch (error) {
    const typed = error as { status?: number; code?: string; param?: string; name?: string; message?: string };
    // OpenAI's message is limited to schema errors in this diagnostic. Never print raw provider errors or URLs.
    console.error({ name: typed.name, status: typed.status, code: typed.code, param: typed.param });
    if (["Invalid scenario total", "Unsupported scorecard facts", "OpenAI returned an incomplete or refused analysis."].includes(typed.message ?? "")) console.error(typed.message);
    if (typed.code === "invalid_json_schema") console.error(typed.message?.slice(0, 1500));
    if (!typed.status && typed.message && !typed.message.includes("sk-") && !typed.message.includes("postgres")) console.error(typed.message.slice(0, 1500));
    process.exitCode = 1;
  }
}
main().catch(() => { console.error("Snapshot collection failed"); process.exitCode = 1; });
