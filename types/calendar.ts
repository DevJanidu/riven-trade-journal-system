export interface CalendarDay {
  date: string;
  tradeCount: number;
  wins: number;
  losses: number;
  breakEvens: number;
  netR: number;
}

export interface CalendarData {
  month: string;
  summary: Omit<CalendarDay, "date" | "tradeCount"> & { tradingDays: number; totalTrades: number; winRate: number };
  days: CalendarDay[];
}
