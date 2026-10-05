import { calculateWinRate } from "./calculations";
import type { CalendarData, CalendarDay } from "@/types/calendar";

// UTC is used only for calendar arithmetic. Trade date strings never change timezone.
export function calendarDate(value: string) {
  return new Date(`${value}T00:00:00Z`);
}

export function shiftMonth(month: string, offset: number) {
  const date = calendarDate(`${month}-01`);
  date.setUTCMonth(date.getUTCMonth() + offset);
  if (date.getUTCFullYear() < 1 || date.getUTCFullYear() > 9999) return month;
  return date.toISOString().slice(0, 7);
}

export function calendarCells(month: string): Array<string | null> {
  const first = calendarDate(`${month}-01`);
  const offset = (first.getUTCDay() + 6) % 7;
  const last = new Date(first);
  last.setUTCMonth(last.getUTCMonth() + 1);
  last.setUTCDate(0);
  const count = last.getUTCDate();
  return Array.from({ length: Math.ceil((offset + count) / 7) * 7 }, (_, index) =>
    index >= offset && index < offset + count ? `${month}-${String(index - offset + 1).padStart(2, "0")}` : null);
}

export function dayTone(netR: number) {
  return netR > 0 ? "profit" : netR < 0 ? "loss" : "neutral";
}

export function calendarData(month: string, days: CalendarDay[]): CalendarData {
  const totals = days.reduce((total, day) => ({
    totalTrades: total.totalTrades + day.tradeCount,
    wins: total.wins + day.wins,
    losses: total.losses + day.losses,
    breakEvens: total.breakEvens + day.breakEvens,
    // Match the database's four-decimal R precision without float drift.
    rUnits: total.rUnits + Math.round(day.netR * 10000),
  }), { totalTrades: 0, wins: 0, losses: 0, breakEvens: 0, rUnits: 0 });
  return {
    month,
    days,
    summary: {
      tradingDays: days.length, totalTrades: totals.totalTrades,
      wins: totals.wins, losses: totals.losses, breakEvens: totals.breakEvens,
      winRate: calculateWinRate(totals.wins, totals.losses), netR: totals.rUnits / 10000,
    },
  };
}
