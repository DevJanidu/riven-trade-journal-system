export const sessions = ["Asia", "London", "New York"] as const;
export const directions = ["Long", "Short"] as const;
export const results = ["Win", "Loss", "Break Even"] as const;
export const setups = [
  "Liquidity Sweep",
  "Break & Retest",
  "Reversal",
  "Continuation",
  "Other",
] as const;
export const emotions = [
  "Calm",
  "Confident",
  "FOMO",
  "Fear",
  "Revenge",
  "Impatient",
] as const;

export interface Trade {
  id: string;
  date: string;
  instrument: "XAUUSD";
  session: (typeof sessions)[number];
  direction: (typeof directions)[number];
  entry: number;
  stopLoss: number;
  takeProfit: number;
  riskAmount: number;
  plannedRR: number;
  actualR: number;
  profitLoss: number;
  profitBooked?: number;
  breakEvenAfterProfit?: boolean;
  result: (typeof results)[number];
  setup: string;
  setupGrade?: "A" | "A+";
  setupChecklist?: string[];
  setupAvoidChecklist?: string[];
  psychologyReady?: boolean;
  psychologyAnswer?: string;
  tradingViewUrl?: string;
  beforeScreenshot?: string;
  afterScreenshot?: string;
  entryReason: string;
  wentWell: string;
  wentWrong: string;
  improvement: string;
  followedRules: boolean;
  emotion: (typeof emotions)[number];
  createdAt: string;
  updatedAt: string;
}

export interface TradeFilters {
  date?: string;
  month?: string;
  session?: Trade["session"];
  setup?: string;
  result?: Trade["result"];
  direction?: Trade["direction"];
}

export interface DashboardSummary {
  totalTrades: number;
  wins: number;
  losses: number;
  breakEvens: number;
  winRate: number;
  netR: number;
  averageR: number;
  averageWinningR: number;
  averageRR: number;
  averagePlannedRR: number;
  profitFactor: number | null;
  expectancy: number;
  bestTrade: number;
  worstTrade: number;
}

export interface SetupPerformance {
  setup: Trade["setup"];
  trades: number;
  wins: number;
  losses: number;
  breakEvens: number;
  winRate: number;
  netR: number;
  averageR: number;
}

export interface CumulativeRPoint {
  trade: number;
  date: string;
  label: string;
  value: number;
  dailyR: number;
  tradeR: number;
}

export type ApiSuccess<T> = { success: true; data: T };
export type ApiFailure = { success: false; error: string; fieldErrors?: Record<string, string[]> };
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;
