import type { Frequency } from "./types";

export interface FredSeriesConfig {
  key: string; id: string; name: string; frequency: Frequency; units: string;
  kind: "rate" | "index" | "level" | "growth"; seasonalAdjustment: string; inflation?: boolean; staleAfterDays?: number;
}
// Verified against each official FRED series page. IDs belong only here.
export const FRED_SERIES: FredSeriesConfig[] = [
  { key: "us2y", id: "DGS2", name: "US 2Y Treasury yield", frequency: "daily", units: "Percent", kind: "rate", seasonalAdjustment: "Not seasonally adjusted" },
  { key: "us10y", id: "DGS10", name: "US 10Y Treasury yield", frequency: "daily", units: "Percent", kind: "rate", seasonalAdjustment: "Not seasonally adjusted" },
  { key: "realYield10y", id: "DFII10", name: "US 10Y TIPS real yield", frequency: "daily", units: "Percent", kind: "rate", seasonalAdjustment: "Not seasonally adjusted" },
  { key: "effectiveFedFundsRate", id: "DFF", name: "Effective federal funds rate", frequency: "daily", units: "Percent", kind: "rate", seasonalAdjustment: "Not seasonally adjusted" },
  { key: "cpi", id: "CPIAUCSL", name: "CPI price index", frequency: "monthly", units: "Index 1982–84=100", kind: "index", inflation: true, seasonalAdjustment: "Seasonally adjusted" },
  { key: "coreCpi", id: "CPILFESL", name: "Core CPI price index", frequency: "monthly", units: "Index 1982–84=100", kind: "index", inflation: true, seasonalAdjustment: "Seasonally adjusted" },
  { key: "pce", id: "PCEPI", name: "PCE price index", frequency: "monthly", units: "Index 2017=100", kind: "index", inflation: true, seasonalAdjustment: "Seasonally adjusted" },
  { key: "corePce", id: "PCEPILFE", name: "Core PCE price index", frequency: "monthly", units: "Index 2017=100", kind: "index", inflation: true, seasonalAdjustment: "Seasonally adjusted" },
  { key: "payrolls", id: "PAYEMS", name: "Total nonfarm payroll employment", frequency: "monthly", units: "Thousands of persons", kind: "level", seasonalAdjustment: "Seasonally adjusted" },
  { key: "unemployment", id: "UNRATE", name: "Unemployment rate", frequency: "monthly", units: "Percent", kind: "rate", seasonalAdjustment: "Seasonally adjusted" },
  { key: "joblessClaims", id: "ICSA", name: "Initial jobless claims", frequency: "weekly", units: "Persons", kind: "level", seasonalAdjustment: "Seasonally adjusted" },
  { key: "averageHourlyEarnings", id: "CES0500000003", name: "Average hourly earnings, total private", frequency: "monthly", units: "Dollars per hour", kind: "level", seasonalAdjustment: "Seasonally adjusted" },
  { key: "gdp", id: "A191RL1Q225SBEA", name: "Real GDP growth (quarterly annualized)", frequency: "quarterly", units: "Percent change from preceding period, annualized", kind: "growth", seasonalAdjustment: "Seasonally adjusted annual rate" },
  { key: "retailSales", id: "RSAFS", name: "Advance retail and food services sales", frequency: "monthly", units: "Millions of dollars", kind: "level", seasonalAdjustment: "Seasonally adjusted" },
  { key: "industrialProduction", id: "INDPRO", name: "Industrial production index", frequency: "monthly", units: "Index 2017=100", kind: "index", seasonalAdjustment: "Seasonally adjusted" },
  { key: "usdBroad", id: "DTWEXBGS", name: "Nominal broad trade-weighted US dollar index (not DXY)", frequency: "daily", units: "Index Jan 2006=100", kind: "index", seasonalAdjustment: "Not seasonally adjusted", staleAfterDays: 14 },
];
export const fredCacheSeconds = (frequency: Frequency) => ({ daily: 21600, weekly: 43200, monthly: 86400, quarterly: 172800 })[frequency];
