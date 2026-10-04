import type { CumulativeRPoint, DashboardSummary, SetupPerformance, Trade } from "@/types/trade";

const R_SCALE = 10000;
const toCents = (value: number) => Math.round(value * 100);
const toRUnits = (value: number) => Math.round(value * R_SCALE);
const fromRUnits = (value: number) => value / R_SCALE;
const round = (value: number, places = 4) => Number(value.toFixed(places));

export function calculatePlannedRR(entry: number, stopLoss: number, takeProfit: number, direction: Trade["direction"]) {
  const entryCents = toCents(entry);
  const stopCents = toCents(stopLoss);
  const targetCents = toCents(takeProfit);
  const risk = direction === "Long" ? entryCents - stopCents : stopCents - entryCents;
  const reward = direction === "Long" ? targetCents - entryCents : entryCents - targetCents;
  return risk > 0 && reward > 0 ? round(reward / risk) : 0;
}

export function calculateActualR(profitLoss: number, riskAmount: number) {
  const riskCents = toCents(riskAmount);
  return riskCents > 0 ? round(toCents(profitLoss) / riskCents) : 0;
}

export function calculateProfitLoss(actualR: number, riskAmount: number) {
  return Math.round(toRUnits(actualR) * toCents(riskAmount) / R_SCALE) / 100;
}

export function calculateResult(profitLoss: number): Trade["result"] {
  const cents = toCents(profitLoss);
  return cents > 0 ? "Win" : cents < 0 ? "Loss" : "Break Even";
}

export function calculateWinRate(wins: number, losses: number) {
  return wins + losses > 0 ? round(wins / (wins + losses) * 100, 2) : 0;
}

export function calculateNetR(trades: Trade[]) {
  return fromRUnits(trades.reduce((total, trade) => total + toRUnits(trade.actualR), 0));
}

export function calculateAverageR(trades: Trade[]) {
  return trades.length ? round(calculateNetR(trades) / trades.length) : 0;
}

export function calculateAverageRR(trades: Trade[]) {
  return trades.length ? round(trades.reduce((total, trade) => total + toRUnits(trade.plannedRR), 0) / R_SCALE / trades.length) : 0;
}

export function calculateBestTrade(trades: Trade[]) {
  return trades.length ? Math.max(...trades.map(trade => trade.actualR)) : 0;
}

export function calculateWorstTrade(trades: Trade[]) {
  return trades.length ? Math.min(...trades.map(trade => trade.actualR)) : 0;
}

export function calculateStats(trades: Trade[]): DashboardSummary {
  const wins = trades.filter(trade => trade.result === "Win");
  const losses = trades.filter(trade => trade.result === "Loss");
  const breakEvens = trades.length - wins.length - losses.length;
  const grossWins = wins.reduce((total, trade) => total + toRUnits(trade.actualR), 0);
  const grossLosses = Math.abs(losses.reduce((total, trade) => total + toRUnits(trade.actualR), 0));
  const netR = calculateNetR(trades);
  return {
    totalTrades: trades.length,
    wins: wins.length,
    losses: losses.length,
    breakEvens,
    winRate: calculateWinRate(wins.length, losses.length),
    netR,
    averageR: calculateAverageR(trades),
    averageWinningR: wins.length ? round(fromRUnits(grossWins) / wins.length) : 0,
    averageRR: calculateAverageRR(trades),
    averagePlannedRR: calculateAverageRR(trades),
    profitFactor: grossLosses > 0 ? round(grossWins / grossLosses, 2) : null,
    expectancy: calculateAverageR(trades),
    bestTrade: calculateBestTrade(trades),
    worstTrade: calculateWorstTrade(trades),
  };
}

export function calculateSetupPerformance(trades: Trade[]): SetupPerformance[] {
  const groups = new Map<Trade["setup"], Trade[]>();
  for (const trade of trades) groups.set(trade.setup, [...(groups.get(trade.setup) ?? []), trade]);
  return [...groups].map(([setup, entries]) => {
    const stats = calculateStats(entries);
    return { setup, trades: stats.totalTrades, wins: stats.wins, losses: stats.losses, breakEvens: stats.breakEvens, winRate: stats.winRate, netR: stats.netR, averageR: stats.averageR };
  }).sort((a, b) => b.netR - a.netR);
}

export function calculateCumulativeR(trades: Trade[]): CumulativeRPoint[] {
  let runningUnits = 0;
  return [...trades].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)).map((trade, index) => {
    runningUnits += toRUnits(trade.actualR);
    return {
      trade: index + 1,
      date: trade.date,
      label: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${trade.date}T00:00:00Z`)),
      value: fromRUnits(runningUnits),
      dailyR: trade.actualR,
      tradeR: trade.actualR,
    };
  });
}

export function calculateDailyPerformance(trades: Trade[]) {
  const days = new Map<string, { date: string; trades: number; rUnits: number }>();
  for (const trade of trades) {
    const day = days.get(trade.date) ?? { date: trade.date, trades: 0, rUnits: 0 };
    day.trades += 1;
    day.rUnits += toRUnits(trade.actualR);
    days.set(trade.date, day);
  }
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date)).map(day => ({
    date: day.date,
    label: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${day.date}T00:00:00Z`)),
    trades: day.trades,
    value: fromRUnits(day.rUnits),
  }));
}

export function calculateRDistribution(trades: Trade[]) {
  const buckets = [
    { label: "< -1R", matches: (r: number) => r < -1 },
    { label: "-1 to 0", matches: (r: number) => r >= -1 && r < 0 },
    { label: "0 to 1", matches: (r: number) => r >= 0 && r < 1 },
    { label: "1 to 2", matches: (r: number) => r >= 1 && r < 2 },
    { label: "2 to 3", matches: (r: number) => r >= 2 && r < 3 },
    { label: "3R+", matches: (r: number) => r >= 3 },
  ];
  return buckets.map(({ label, matches }) => ({ label, count: trades.filter(trade => matches(trade.actualR)).length }));
}

export function calculateGroupPerformance(trades: Trade[], key: "session" | "direction") {
  const groups = new Map<string, Trade[]>();
  for (const trade of trades) groups.set(trade[key], [...(groups.get(trade[key]) ?? []), trade]);
  return [...groups].map(([name, entries]) => ({ name, ...calculateStats(entries) })).sort((a, b) => b.netR - a.netR);
}

export function monthBounds(month: string) {
  const [year, value] = month.split("-").map(Number);
  const start = `${year}-${String(value).padStart(2, "0")}-01`;
  const end = new Date(Date.UTC(year, value, 1)).toISOString().slice(0, 10);
  return { start, end };
}

export function getTradesForMonth(trades: Trade[], month: string) {
  const { start, end } = monthBounds(month);
  return trades.filter(trade => trade.date >= start && trade.date < end);
}
