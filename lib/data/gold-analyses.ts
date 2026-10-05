import "server-only";
import { randomUUID } from "node:crypto";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { goldGenerationLocks, goldWeeklyAnalyses } from "@/lib/db/schema";
import { technicalAlignment, type GoldWeeklyAnalysis, type TechnicalContext } from "@/lib/ai/schemas";
import { GOLD_PROMPT_VERSION } from "@/lib/ai/prompts";
import type { GoldAnalysisSnapshot } from "@/lib/market-data/types";

export type SavedGoldAnalysis = typeof goldWeeklyAnalyses.$inferSelect;
export async function getAnalysisHistoryCount(userId: string) {
  const [row] = await getDb().select({ total: count() }).from(goldWeeklyAnalyses).where(eq(goldWeeklyAnalyses.userId, userId));
  return row?.total ?? 0;
}
export async function getAnalysisHistory(userId: string, offset = 0, limit = 30) {
  return getDb().select({ id: goldWeeklyAnalyses.id, weekStart: goldWeeklyAnalyses.weekStart, weekEnd: goldWeeklyAnalyses.weekEnd,
    fundamentalBias: goldWeeklyAnalyses.fundamentalBias, confidence: goldWeeklyAnalyses.confidence, createdAt: goldWeeklyAnalyses.createdAt })
    .from(goldWeeklyAnalyses).where(eq(goldWeeklyAnalyses.userId, userId)).orderBy(desc(goldWeeklyAnalyses.createdAt), desc(goldWeeklyAnalyses.id)).limit(limit).offset(offset);
}
export async function getCurrentGoldAnalysis(userId: string) {
  const [analysis] = await getDb().select().from(goldWeeklyAnalyses).where(eq(goldWeeklyAnalyses.userId, userId)).orderBy(desc(goldWeeklyAnalyses.createdAt), desc(goldWeeklyAnalyses.id)).limit(1);
  return analysis ?? null;
}
export async function getGoldAnalysisById(userId: string, id: string) {
  const [analysis] = await getDb().select().from(goldWeeklyAnalyses).where(and(eq(goldWeeklyAnalyses.userId, userId), eq(goldWeeklyAnalyses.id, id))).limit(1);
  return analysis ?? null;
}
export async function deleteGoldAnalysis(userId: string, id: string) {
  const [deleted] = await getDb().delete(goldWeeklyAnalyses)
    .where(and(eq(goldWeeklyAnalyses.userId, userId), eq(goldWeeklyAnalyses.id, id)))
    .returning({ id: goldWeeklyAnalyses.id });
  return deleted ?? null;
}
export async function saveGoldAnalysis(userId: string, snapshot: GoldAnalysisSnapshot, analysis: GoldWeeklyAnalysis, context: TechnicalContext, model: string) {
  const [saved] = await getDb().insert(goldWeeklyAnalyses).values({
    userId, analysisDate: new Date(snapshot.analysisDate), weekStart: snapshot.weekStart, weekEnd: snapshot.weekEnd, model, promptVersion: GOLD_PROMPT_VERSION,
    goldPrice: snapshot.gold?.latestPrice?.toFixed(6) ?? null, fundamentalBias: analysis.bias, confidence: analysis.confidence,
    bullishProbability: analysis.probabilities.bullish, bearishProbability: analysis.probabilities.bearish, rangeProbability: analysis.probabilities.range,
    summary: analysis.summary, analysis, dataSnapshot: snapshot, technicalContext: context, technicalAlignment: technicalAlignment(analysis.bias, context.bias),
  }).returning();
  if (!saved) throw new Error("Analysis could not be saved.");
  return saved;
}
export class AnalysisCooldownError extends Error {
  constructor(public readonly retryAfterSeconds: number) { super("Analysis generation is in progress or cooling down. Please wait before generating again."); }
}
export async function claimGeneration(userId: string) {
  const token = randomUUID();
  const claimed = await getDb().execute(sql`INSERT INTO gold_generation_locks (user_id, token, locked_until, next_allowed_at)
    VALUES (${userId}::uuid, ${token}::uuid, now() + interval '10 minutes', now() + interval '15 minutes')
    ON CONFLICT (user_id) DO UPDATE SET token = EXCLUDED.token, locked_until = EXCLUDED.locked_until, next_allowed_at = EXCLUDED.next_allowed_at
    WHERE gold_generation_locks.locked_until <= now() AND gold_generation_locks.next_allowed_at <= now()
    RETURNING user_id`);
  if (!claimed.rows.length) {
    const [lock] = await getDb().select().from(goldGenerationLocks).where(eq(goldGenerationLocks.userId, userId)).limit(1);
    throw new AnalysisCooldownError(Math.max(1, Math.ceil(((lock?.nextAllowedAt.getTime() ?? Date.now() + 60000) - Date.now()) / 1000)));
  }
  return token;
}
export async function releaseGeneration(userId: string, token: string) {
  await getDb().update(goldGenerationLocks).set({ lockedUntil: new Date(0) }).where(and(eq(goldGenerationLocks.userId, userId), eq(goldGenerationLocks.token, token)));
}
