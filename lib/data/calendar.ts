import "server-only";
import { and, asc, eq, gte, lt, sql } from "drizzle-orm";
import { requireUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { trades } from "@/lib/db/schema";
import { calendarData } from "@/lib/trading/calendar";
import { monthBounds } from "@/lib/trading/calculations";
import { monthSchema } from "@/lib/validations/trade";

export async function getCalendarData(month: string) {
  const userId = await requireUserId();
  const { start, end } = monthBounds(monthSchema.parse(month));
  // No shared cache: each read is fresh, scoped to the session and selected month.
  const days = await getDb().select({
    date: trades.date,
    tradeCount: sql<number>`count(*)`.mapWith(Number),
    wins: sql<number>`count(*) filter (where ${trades.result} = 'Win')`.mapWith(Number),
    losses: sql<number>`count(*) filter (where ${trades.result} = 'Loss')`.mapWith(Number),
    breakEvens: sql<number>`count(*) filter (where ${trades.result} = 'Break Even')`.mapWith(Number),
    netR: sql<number>`coalesce(sum(${trades.actualR}), 0)`.mapWith(Number),
  }).from(trades)
    .where(and(eq(trades.userId, userId), gte(trades.date, start), lt(trades.date, end)))
    .groupBy(trades.date).orderBy(asc(trades.date));
  return calendarData(month, days);
}
