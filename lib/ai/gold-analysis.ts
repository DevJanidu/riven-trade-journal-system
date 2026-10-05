import "server-only";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { goldWeeklyAnalysisSchema, validateAnalysis } from "./schemas";
import { GOLD_SYSTEM_INSTRUCTION } from "./prompts";
import type { GoldAnalysisSnapshot } from "@/lib/market-data/types";

export const goldAnalysisModel = () => process.env.OPENAI_GOLD_MODEL?.trim() || "gpt-6-luna";
export function analysisRequest(snapshot: GoldAnalysisSnapshot) {
  return {
    model: goldAnalysisModel(), reasoning: { effort: "medium" as const }, store: false,
    max_output_tokens: 6500,
    input: [{ role: "system" as const, content: GOLD_SYSTEM_INSTRUCTION }, { role: "user" as const, content: JSON.stringify({ snapshot }) }],
    text: { format: zodTextFormat(goldWeeklyAnalysisSchema, "gold_weekly_analysis") },
  };
}
export async function analyzeGold(snapshot: GoldAnalysisSnapshot, testClient?: OpenAI) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey && !testClient) throw new Error("OpenAI is not configured. Add OPENAI_API_KEY on the server.");
  const client = testClient ?? new OpenAI({ apiKey, maxRetries: 0, timeout: 90000 });
  // Exactly one request. No tools, browsing, per-indicator requests, or automatic retry.
  try {
    const response = await client.responses.parse(analysisRequest(snapshot));
    if (response.status !== "completed" || !response.output_parsed) throw new Error("Incomplete or refused analysis");
    return validateAnalysis(response.output_parsed, snapshot.dataQuality, ["gold", "positioning", ...Object.keys(snapshot.macro)]);
  } catch {
    throw new Error("OpenAI analysis could not be generated or validated. Please try again after the cooldown.");
  }
}
