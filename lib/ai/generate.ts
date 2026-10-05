import "server-only";
import { analyzeGold, goldAnalysisModel } from "./gold-analysis";
import { technicalContextSchema, type TechnicalContext, type GoldWeeklyAnalysis } from "./schemas";
import { collectSnapshot } from "@/lib/market-data/snapshot";
import { claimGeneration, releaseGeneration, saveGoldAnalysis } from "@/lib/data/gold-analyses";
import type { GoldAnalysisSnapshot } from "@/lib/market-data/types";

export interface GenerationDependencies<T> {
  claim: (userId: string) => Promise<string>;
  collect: () => Promise<GoldAnalysisSnapshot>;
  analyze: (snapshot: GoldAnalysisSnapshot, context: TechnicalContext) => Promise<GoldWeeklyAnalysis>;
  save: (userId: string, snapshot: GoldAnalysisSnapshot, analysis: GoldWeeklyAnalysis, context: TechnicalContext, model: string) => Promise<T>;
  release: (userId: string, token: string) => Promise<void>;
}
export async function runGeneration<T>(userId: string, context: TechnicalContext, dependencies: GenerationDependencies<T>) {
  const token = await dependencies.claim(userId);
  try {
    const snapshot = await dependencies.collect();
    const analysis = await dependencies.analyze(snapshot, context);
    try { return await dependencies.save(userId, snapshot, analysis, context, goldAnalysisModel()); }
    catch { throw new Error("Analysis could not be saved. Please wait for the cooldown before retrying."); }
  } finally {
    await dependencies.release(userId, token).catch(() => undefined);
  }
}
export async function generateGoldAnalysis(userId: string) {
  if (!process.env.OPENAI_API_KEY) throw new Error("OpenAI is not configured. Add OPENAI_API_KEY on the server.");
  return runGeneration(userId, technicalContextSchema.parse({}), {
    claim: claimGeneration, collect: collectSnapshot, analyze: snapshot => analyzeGold(snapshot), save: saveGoldAnalysis, release: releaseGeneration,
  });
}
