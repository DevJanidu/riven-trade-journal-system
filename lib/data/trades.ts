import "server-only";

import { and, asc, desc, eq, gte, lt, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { trades, type TradeRow } from "@/lib/db/schema";
import { createTradeSchema, type CreateTradeInput, type UpdateTradeInput } from "@/lib/validations/trade";
import {
  calculateActualR, calculateCumulativeR, calculateDailyPerformance, calculateGroupPerformance,
  calculatePlannedRR, calculateRDistribution, calculateSetupPerformance,
  calculateStats, monthBounds,
} from "@/lib/trading/calculations";
import type { CumulativeRPoint, DashboardSummary, SetupPerformance, Trade, TradeFilters } from "@/types/trade";
import { deleteCached, getCached, setCached } from "@/lib/cache";
import { requireUserId } from "@/lib/auth/session";

type DashboardData = {
  month: string;
  summary: DashboardSummary;
  cumulativeR: CumulativeRPoint[];
  dailyPerformance: ReturnType<typeof calculateDailyPerformance>;
  rDistribution: ReturnType<typeof calculateRDistribution>;
  setupPerformance: SetupPerformance[];
  sessionPerformance: ReturnType<typeof calculateGroupPerformance>;
  directionPerformance: ReturnType<typeof calculateGroupPerformance>;
  recentTrades: Trade[];
};

function toTrade(row: TradeRow): Trade {
  return {
    id: row.id,
    date: row.date,
    instrument: "XAUUSD",
    session: row.session,
    direction: row.direction,
    entry: Number(row.entry),
    stopLoss: Number(row.stopLoss),
    takeProfit: Number(row.takeProfit),
    riskAmount: Number(row.riskAmount),
    plannedRR: Number(row.plannedRR),
    actualR: Number(row.actualR),
    profitLoss: Number(row.profitLoss),
    profitBooked: Number(row.profitBooked),
    breakEvenAfterProfit: row.breakEvenAfterProfit,
    result: row.result,
    setup: row.setup,
    setupGrade: row.setupGrade as Trade["setupGrade"] ?? undefined,
    setupChecklist: row.setupChecklist ?? [],
    setupAvoidChecklist: row.setupAvoidChecklist ?? [],
    psychologyReady: row.psychologyReady,
    psychologyAnswer: row.psychologyAnswer,
    tradingViewUrl: row.tradingViewUrl ?? undefined,
    beforeScreenshot: row.beforeScreenshot ?? undefined,
    afterScreenshot: row.afterScreenshot ?? undefined,
    entryReason: row.entryReason,
    wentWell: row.wentWell,
    wentWrong: row.wentWrong,
    improvement: row.improvement,
    followedRules: row.followedRules,
    emotion: row.emotion,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function conditionsFor(filters: TradeFilters, userId: string): SQL[] {
  const conditions: SQL[] = [eq(trades.userId, userId)];
  if (filters.date) {
    conditions.push(eq(trades.date, filters.date));
  } else if (filters.month) {
    const { start, end } = monthBounds(filters.month);
    conditions.push(gte(trades.date, start), lt(trades.date, end));
  } else {
    if (filters.startDate) conditions.push(gte(trades.date, filters.startDate));
    if (filters.endDateExclusive) conditions.push(lt(trades.date, filters.endDateExclusive));
  }
  if (filters.session) conditions.push(eq(trades.session, filters.session));
  if (filters.setup) conditions.push(eq(trades.setup, filters.setup));
  if (filters.result) conditions.push(eq(trades.result, filters.result));
  if (filters.direction) conditions.push(eq(trades.direction, filters.direction));
  return conditions;
}

export async function getTrades(filters: TradeFilters = {}): Promise<Trade[]> {
  const userId = await requireUserId();
  try {
    const rows = await getDb().select().from(trades)
      .where(and(...conditionsFor(filters, userId)))
      .orderBy(desc(trades.date), desc(trades.createdAt), desc(trades.id));
    return rows.map(toTrade);
  } catch (error) {
    if (!isPreflightColumnError(error)) throw error;
    return getLegacyTrades(filters, userId);
  }
}

function isPreflightColumnError(error: unknown) {
  const messages: string[] = [];
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current; depth++) {
    messages.push(current instanceof Error ? current.message : String(current));
    current = current && typeof current === "object" && "cause" in current ? (current as { cause?: unknown }).cause : undefined;
  }
  return /column .*?(setup_grade|setup_checklist|setup_avoid_checklist|psychology_ready|psychology_answer).* does not exist/i.test(messages.join(" "));
}

async function getLegacyTrades(filters: TradeFilters, userId: string): Promise<Trade[]> {
  const result = await getDb().execute(sql`SELECT id, user_id AS "userId", date, instrument, session, direction, entry, stop_loss AS "stopLoss", take_profit AS "takeProfit", risk_amount AS "riskAmount", planned_rr AS "plannedRR", actual_r AS "actualR", profit_loss AS "profitLoss", result, setup, trading_view_url AS "tradingViewUrl", before_screenshot AS "beforeScreenshot", after_screenshot AS "afterScreenshot", entry_reason AS "entryReason", went_well AS "wentWell", went_wrong AS "wentWrong", improvement, followed_rules AS "followedRules", emotion, created_at AS "createdAt", updated_at AS "updatedAt" FROM trades WHERE ${and(...conditionsFor(filters, userId))} ORDER BY date DESC, created_at DESC, id DESC`);
  const rows = (result as unknown as Array<Record<string, unknown>>).map(row => ({
    ...row,
    setupGrade: null,
    setupChecklist: [],
    setupAvoidChecklist: [],
    psychologyReady: false,
    psychologyAnswer: "",
    profitBooked: "0",
    breakEvenAfterProfit: false,
  })) as unknown as TradeRow[];
  return rows.map(toTrade);
}

export async function getMonthlyTrades(month: string): Promise<Trade[]> {
  const userId = await requireUserId();
  const cacheKey = `tradezilla:trades:${userId}:${month}`;
  const cached = await getCached<Trade[]>(cacheKey);
  if (cached !== null) return cached;
  const monthly = await getTrades({ month });
  await setCached(cacheKey, monthly, 45);
  return monthly;
}

export async function getTradesForRange(startDate: string, endDateExclusive: string): Promise<Trade[]> {
  return getTrades({ startDate, endDateExclusive });
}

async function invalidateMonth(userId: string, ...months: string[]) {
  // Calendar reads are uncached. Invalidate only this user's affected cached months.
  await deleteCached(...[...new Set(months)].flatMap(month => [
    `tradezilla:trades:${userId}:${month}`,
    `tradezilla:dashboard:${userId}:${month}`,
  ]));
}

export async function getRecentTrades(month: string, limit = 5): Promise<Trade[]> {
  const userId = await requireUserId();
  const { start, end } = monthBounds(month);
  const rows = await getDb().select().from(trades)
    .where(and(eq(trades.userId, userId), gte(trades.date, start), lt(trades.date, end)))
    .orderBy(desc(trades.date), desc(trades.createdAt), desc(trades.id))
    .limit(limit);
  return rows.map(toTrade);
}

export async function getTradeById(id: string): Promise<Trade | null> {
  const userId = await requireUserId();
  try {
    const [row] = await getDb().select().from(trades).where(and(eq(trades.id, id), eq(trades.userId, userId))).limit(1);
    return row ? toTrade(row) : null;
  } catch (error) {
    if (!isPreflightColumnError(error)) throw error;
    const [trade] = (await getLegacyTrades({}, userId)).filter(item => item.id === id);
    return trade ?? null;
  }
}

function storedValues(input: CreateTradeInput) {
  const plannedRR = calculatePlannedRR(input.entry, input.stopLoss, input.takeProfit, input.direction);
  const actualR = calculateActualR(input.profitLoss, input.riskAmount);
  return {
    date: input.date,
    instrument: "XAUUSD",
    session: input.session,
    direction: input.direction,
    entry: input.entry.toFixed(2),
    stopLoss: input.stopLoss.toFixed(2),
    takeProfit: input.takeProfit.toFixed(2),
    riskAmount: input.riskAmount.toFixed(2),
    plannedRR: plannedRR.toFixed(4),
    actualR: actualR.toFixed(4),
    profitLoss: input.profitLoss.toFixed(2),
    profitBooked: input.profitBooked.toFixed(2),
    breakEvenAfterProfit: input.breakEvenAfterProfit,
    result: input.profitLoss > 0 ? "Win" : input.profitLoss < 0 ? "Loss" : (input.result ?? "Break Even"),
    setup: input.setup,
    setupGrade: input.setupGrade ?? null,
    setupChecklist: input.setupChecklist,
    setupAvoidChecklist: input.setupAvoidChecklist,
    psychologyReady: input.psychologyReady,
    psychologyAnswer: input.psychologyAnswer,
    tradingViewUrl: input.tradingViewUrl ?? null,
    beforeScreenshot: input.beforeScreenshot ?? null,
    afterScreenshot: input.afterScreenshot ?? null,
    entryReason: input.entryReason,
    wentWell: input.wentWell,
    wentWrong: input.wentWrong,
    improvement: input.improvement,
    followedRules: input.followedRules,
    emotion: input.emotion,
  };
}

export async function createTrade(input: CreateTradeInput, id?: string): Promise<Trade> {
  const userId = await requireUserId();
  const [row] = await getDb().insert(trades).values({ ...storedValues(input), userId, ...(id ? { id } : {}) }).returning();
  await invalidateMonth(userId, input.date.slice(0, 7));
  return toTrade(row);
}

const dependentFields = new Set<keyof UpdateTradeInput>([
  "entry", "stopLoss", "takeProfit", "direction", "riskAmount", "profitLoss", "result", "profitBooked", "breakEvenAfterProfit",
]);

function editableValues(existing: Trade) {
  return {
    instrument: existing.instrument,
    date: existing.date,
    session: existing.session,
    direction: existing.direction,
    entry: existing.entry,
    stopLoss: existing.stopLoss,
    takeProfit: existing.takeProfit,
    riskAmount: existing.riskAmount,
    profitLoss: existing.profitLoss,
    result: existing.result,
    profitBooked: existing.profitBooked,
    breakEvenAfterProfit: existing.breakEvenAfterProfit,
    setup: existing.setup,
    setupGrade: existing.setupGrade,
    setupChecklist: existing.setupChecklist,
    setupAvoidChecklist: existing.setupAvoidChecklist,
    psychologyReady: existing.psychologyReady,
    psychologyAnswer: existing.psychologyAnswer,
    tradingViewUrl: existing.tradingViewUrl,
    beforeScreenshot: existing.beforeScreenshot,
    afterScreenshot: existing.afterScreenshot,
    entryReason: existing.entryReason,
    wentWell: existing.wentWell,
    wentWrong: existing.wentWrong,
    improvement: existing.improvement,
    followedRules: existing.followedRules,
    emotion: existing.emotion,
  };
}

export async function updateTrade(id: string, changes: UpdateTradeInput, previous?: Trade | null): Promise<Trade | null> {
  const userId = await requireUserId();
  const needsPrevious = changes.date !== undefined || Object.keys(changes).some(key => dependentFields.has(key as keyof UpdateTradeInput));
  const existing = needsPrevious ? previous ?? await getTradeById(id) : previous;
  if (needsPrevious && !existing) return null;

  const values: Partial<typeof trades.$inferInsert> = { updatedAt: new Date() };
  if (changes.date !== undefined) values.date = changes.date;
  if (changes.session !== undefined) values.session = changes.session;
  if (changes.direction !== undefined) values.direction = changes.direction;
  if (changes.entry !== undefined) values.entry = changes.entry.toFixed(2);
  if (changes.stopLoss !== undefined) values.stopLoss = changes.stopLoss.toFixed(2);
  if (changes.takeProfit !== undefined) values.takeProfit = changes.takeProfit.toFixed(2);
  if (changes.riskAmount !== undefined) values.riskAmount = changes.riskAmount.toFixed(2);
  if (changes.profitLoss !== undefined) values.profitLoss = changes.profitLoss.toFixed(2);
  if (changes.profitBooked !== undefined) values.profitBooked = changes.profitBooked.toFixed(2);
  if (changes.breakEvenAfterProfit !== undefined) values.breakEvenAfterProfit = changes.breakEvenAfterProfit;
  if (changes.setup !== undefined) values.setup = changes.setup;
  if (changes.setupGrade !== undefined) values.setupGrade = changes.setupGrade;
  if (changes.setupChecklist !== undefined) values.setupChecklist = changes.setupChecklist;
  if (changes.setupAvoidChecklist !== undefined) values.setupAvoidChecklist = changes.setupAvoidChecklist;
  if (changes.psychologyReady !== undefined) values.psychologyReady = changes.psychologyReady;
  if (changes.psychologyAnswer !== undefined) values.psychologyAnswer = changes.psychologyAnswer;
  if (Object.hasOwn(changes, "tradingViewUrl")) values.tradingViewUrl = changes.tradingViewUrl ?? null;
  if (Object.hasOwn(changes, "beforeScreenshot")) values.beforeScreenshot = changes.beforeScreenshot ?? null;
  if (Object.hasOwn(changes, "afterScreenshot")) values.afterScreenshot = changes.afterScreenshot ?? null;
  if (changes.entryReason !== undefined) values.entryReason = changes.entryReason;
  if (changes.wentWell !== undefined) values.wentWell = changes.wentWell;
  if (changes.wentWrong !== undefined) values.wentWrong = changes.wentWrong;
  if (changes.improvement !== undefined) values.improvement = changes.improvement;
  if (changes.followedRules !== undefined) values.followedRules = changes.followedRules;
  if (changes.emotion !== undefined) values.emotion = changes.emotion;

  if (needsPrevious && existing) {
    const merged = createTradeSchema.parse({ ...editableValues(existing), ...changes });
    if (changes.entry !== undefined || changes.stopLoss !== undefined || changes.takeProfit !== undefined || changes.direction !== undefined) {
      values.plannedRR = calculatePlannedRR(merged.entry, merged.stopLoss, merged.takeProfit, merged.direction).toFixed(4);
    }
    if (changes.profitLoss !== undefined || changes.riskAmount !== undefined) {
      values.actualR = calculateActualR(merged.profitLoss, merged.riskAmount).toFixed(4);
    }
    if (changes.profitLoss !== undefined || changes.result !== undefined) {
      values.result = merged.profitLoss > 0 ? "Win" : merged.profitLoss < 0 ? "Loss" : (changes.profitLoss !== undefined ? changes.result ?? "Break Even" : merged.result ?? "Break Even");
    }
  }

  const [row] = await getDb().update(trades).set(values).where(and(eq(trades.id, id), eq(trades.userId, userId))).returning();
  if (row) await invalidateMonth(userId, existing?.date.slice(0, 7) ?? row.date.slice(0, 7), row.date.slice(0, 7));
  return row ? toTrade(row) : null;
}

export async function deleteTrade(id: string): Promise<boolean> {
  const userId = await requireUserId();
  const existing = await getTradeById(id);
  const [row] = await getDb().delete(trades).where(and(eq(trades.id, id), eq(trades.userId, userId))).returning({ id: trades.id });
  if (row && existing) await invalidateMonth(userId, existing.date.slice(0, 7));
  return Boolean(row);
}

export async function getDashboardData(month: string): Promise<DashboardData> {
  const userId = await requireUserId();
  const cacheKey = `tradezilla:dashboard:${userId}:${month}`;
  const cached = await getCached<DashboardData>(cacheKey);
  if (cached) return cached;
  const monthly = await getMonthlyTrades(month);
  const chronological = [...monthly].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const data = {
    month,
    summary: calculateStats(monthly),
    cumulativeR: calculateCumulativeR(chronological),
    dailyPerformance: calculateDailyPerformance(monthly),
    rDistribution: calculateRDistribution(monthly),
    setupPerformance: calculateSetupPerformance(monthly),
    sessionPerformance: calculateGroupPerformance(monthly, "session"),
    directionPerformance: calculateGroupPerformance(monthly, "direction"),
    recentTrades: monthly.slice(0, 5),
  };
  await setCached(cacheKey, data, 45);
  return data;
}

export async function getChronologicalTrades(month: string) {
  const userId = await requireUserId();
  const { start, end } = monthBounds(month);
  const rows = await getDb().select().from(trades).where(and(eq(trades.userId, userId), gte(trades.date, start), lt(trades.date, end)))
    .orderBy(asc(trades.date), asc(trades.createdAt), asc(trades.id));
  return rows.map(toTrade);
}
