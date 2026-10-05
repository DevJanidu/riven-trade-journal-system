import { z } from "zod";
import type { DataQuality } from "@/lib/market-data/types";
import { FRED_SERIES } from "@/lib/market-data/fred-series";

export const fundamentalBiasSchema = z.enum(["strongly_bullish", "moderately_bullish", "neutral", "moderately_bearish", "strongly_bearish"]);
const text = z.string().min(1).max(1600);
const lines = z.array(text).max(10);
const probability = z.number().min(0).max(100);
const scenario = z.object({ probability, conditions: lines.min(1), explanation: text, invalidation: lines.min(1) }).strict();
export const goldWeeklyAnalysisSchema = z.object({
  bias: fundamentalBiasSchema, confidence: probability,
  probabilities: z.object({ bullish: probability, bearish: probability, range: probability }).strict(),
  summary: text,
  macroScorecard: z.array(z.object({
    indicatorKey: z.enum(["gold", "positioning", ...FRED_SERIES.map(row => row.key)] as [string, ...string[]]), goldImpact: z.enum(["bullish", "bearish", "neutral", "uncertain"]),
    importance: z.enum(["high", "medium", "low"]), explanation: text,
  }).strict()).min(3).max(18),
  keyDrivers: lines.min(3).max(6), bullishScenario: scenario, bearishScenario: scenario,
  rangeScenario: z.object({ probability, conditions: lines.min(1), explanation: text }).strict(),
  recentMacroDevelopments: lines, risks: lines.min(1), whatWouldChangeBias: lines.min(1),
}).strict();
export type GoldWeeklyAnalysis = z.infer<typeof goldWeeklyAnalysisSchema> & { dataQuality: DataQuality };
export const technicalContextSchema = z.object({
  bias: z.enum(["bullish", "bearish", "neutral", "not_set"]).default("not_set"),
  resistance: z.string().trim().max(300).default(""), support: z.string().trim().max(300).default(""),
  levels: z.string().trim().max(500).default(""), notes: z.string().trim().max(1500).default(""),
}).strict();
export type TechnicalContext = z.infer<typeof technicalContextSchema>;
export const generateAnalysisSchema = z.object({}).strict();
export type TechnicalAlignment = "aligned" | "partially_aligned" | "conflicting" | "technical_not_provided";
export function technicalAlignment(bias: GoldWeeklyAnalysis["bias"], technicalBias: TechnicalContext["bias"]): TechnicalAlignment {
  if (technicalBias === "not_set") return "technical_not_provided";
  const direction = bias.includes("bullish") ? "bullish" : bias.includes("bearish") ? "bearish" : "neutral";
  return direction === technicalBias ? "aligned" : direction === "neutral" || technicalBias === "neutral" ? "partially_aligned" : "conflicting";
}
export function validateAnalysis(raw: unknown, quality: DataQuality, indicatorKeys: string[]): GoldWeeklyAnalysis {
  const analysis = goldWeeklyAnalysisSchema.parse(raw);
  const values = [analysis.probabilities.bullish, analysis.probabilities.bearish, analysis.probabilities.range];
  const total = values.reduce((sum, value) => sum + value, 0);
  if (Math.abs(total - 100) > 1 || total === 0) throw new Error("Invalid scenario total");
  // Largest remainder allocation preserves the ranking and produces exactly 100 integer points.
  const scaled = values.map(value => value / total * 100);
  const rounded = scaled.map(Math.floor);
  const order = scaled.map((value, index) => ({ index, fraction: value - rounded[index] })).sort((a, b) => b.fraction - a.fraction);
  const remaining = 100 - rounded.reduce((sum, value) => sum + value, 0);
  for (let i = 0; i < remaining; i++) rounded[order[i].index]++;
  const [bullish, bearish, range] = rounded;
  analysis.probabilities = { bullish, bearish, range };
  analysis.bullishScenario.probability = bullish; analysis.bearishScenario.probability = bearish; analysis.rangeScenario.probability = range;
  analysis.confidence = Math.min(Math.round(analysis.confidence), quality.confidenceCap);
  if (new Set(analysis.macroScorecard.map(row => row.indicatorKey)).size !== analysis.macroScorecard.length || analysis.macroScorecard.some(row => !indicatorKeys.includes(row.indicatorKey))) throw new Error("Unsupported scorecard facts");
  // Data quality is deterministic server data, never a model-generated assessment.
  return { ...analysis, dataQuality: quality };
}
