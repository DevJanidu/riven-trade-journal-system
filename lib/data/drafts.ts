import "server-only";

import { and, desc, eq, gte, lt } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { tradeDrafts } from "@/lib/db/schema";
import { createTrade, getTradeById } from "@/lib/data/trades";
import { monthBounds } from "@/lib/trading/calculations";
import type { CreateTradeInput } from "@/lib/validations/trade";
import type { DraftInput, TradeDraft } from "@/lib/validations/draft";
import { requireUserId } from "@/lib/auth/session";

type DraftRow = typeof tradeDrafts.$inferSelect;

function toDraft(row: DraftRow): TradeDraft {
  return { id: row.id, date: row.date, data: row.data, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}

function listDate(data: DraftInput) {
  return data.date || new Date().toISOString().slice(0, 10);
}

export async function getDrafts(month: string): Promise<TradeDraft[]> {
  const userId = await requireUserId();
  const { start, end } = monthBounds(month);
  const rows = await getDb().select().from(tradeDrafts)
    .where(and(eq(tradeDrafts.userId, userId), gte(tradeDrafts.date, start), lt(tradeDrafts.date, end)))
    .orderBy(desc(tradeDrafts.date), desc(tradeDrafts.updatedAt));
  return rows.map(toDraft);
}

export async function getDraftById(id: string): Promise<TradeDraft | null> {
  const userId = await requireUserId();
  const [row] = await getDb().select().from(tradeDrafts).where(and(eq(tradeDrafts.id, id), eq(tradeDrafts.userId, userId))).limit(1);
  return row ? toDraft(row) : null;
}

export async function createDraft(data: DraftInput): Promise<TradeDraft> {
  const userId = await requireUserId();
  const [row] = await getDb().insert(tradeDrafts).values({ date: listDate(data), data, userId }).returning();
  return toDraft(row);
}

export async function updateDraft(id: string, data: DraftInput): Promise<TradeDraft | null> {
  const userId = await requireUserId();
  const [row] = await getDb().update(tradeDrafts).set({ date: listDate(data), data, updatedAt: new Date() })
    .where(and(eq(tradeDrafts.id, id), eq(tradeDrafts.userId, userId))).returning();
  return row ? toDraft(row) : null;
}

export async function deleteDraft(id: string): Promise<boolean> {
  const userId = await requireUserId();
  const [row] = await getDb().delete(tradeDrafts).where(and(eq(tradeDrafts.id, id), eq(tradeDrafts.userId, userId))).returning({ id: tradeDrafts.id });
  return Boolean(row);
}

export async function completeDraft(id: string, input: CreateTradeInput) {
  const draft = await getDraftById(id);
  if (!draft) return null;
  const existing = await getTradeById(id);
  const trade = existing ?? await createTrade(input, id);
  await deleteDraft(id).catch(error => console.error("Unable to remove completed draft", error));
  return trade;
}
