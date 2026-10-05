import { z } from "zod";
import type { Trade } from "@/types/trade";

export const reportPeriods = ["weekly", "monthly", "yearly"] as const;
export type ReportPeriod = (typeof reportPeriods)[number];

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
});

export const reportQuerySchema = z.object({
  period: z.enum(reportPeriods).default("monthly"),
  date: isoDate.default(() => new Date().toISOString().slice(0, 10)),
}).strict();

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function getReportRange(period: ReportPeriod, anchor: string) {
  const date = new Date(`${anchor}T00:00:00Z`);
  let start: Date;
  let end: Date;

  if (period === "weekly") {
    start = new Date(date);
    const weekday = start.getUTCDay();
    start.setUTCDate(start.getUTCDate() - (weekday === 0 ? 6 : weekday - 1));
    end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 7);
  } else if (period === "monthly") {
    start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
    end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
  } else {
    start = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    end = new Date(Date.UTC(date.getUTCFullYear() + 1, 0, 1));
  }

  const inclusiveEnd = new Date(end);
  inclusiveEnd.setUTCDate(inclusiveEnd.getUTCDate() - 1);
  const format = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  const label = period === "monthly"
    ? new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(start)
    : period === "yearly"
      ? String(start.getUTCFullYear())
      : `${format.format(start)} – ${format.format(inclusiveEnd)}`;

  return { start: dateKey(start), endExclusive: dateKey(end), endInclusive: dateKey(inclusiveEnd), label };
}

export function getReportBreakdown(trades: Trade[]) {
  const grouped = new Map<string, { trades: number; wins: number; netR: number; profitLoss: number }>();
  for (const trade of trades) {
    const row = grouped.get(trade.setup) ?? { trades: 0, wins: 0, netR: 0, profitLoss: 0 };
    row.trades += 1;
    row.wins += trade.result === "Win" ? 1 : 0;
    row.netR += trade.actualR;
    row.profitLoss += trade.profitLoss;
    grouped.set(trade.setup, row);
  }
  return [...grouped.entries()].map(([setup, row]) => ({
    setup,
    ...row,
    winRate: row.trades ? row.wins / row.trades * 100 : 0,
  })).sort((a, b) => b.netR - a.netR || a.setup.localeCompare(b.setup));
}
