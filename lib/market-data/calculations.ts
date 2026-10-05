import type { Frequency, Observation } from "./types";

export const isoDay = (date: Date) => date.toISOString().slice(0, 10);
export const round = (value: number, digits = 4) => Number(value.toFixed(digits));
export function numeric(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && (!value.trim() || value.trim() === ".")) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
export function percentChange(latest: number | null, previous: number | null): number | null {
  return latest !== null && previous !== null && previous > 0 ? round((latest / previous - 1) * 100) : null;
}
export function basisPointChange(latest: number | null, previous: number | null): number | null {
  return latest !== null && previous !== null ? round((latest - previous) * 100, 2) : null;
}
export function validDay(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && isoDay(new Date(value)) === value;
}
export function tradingWeek(now = new Date()) {
  const start = new Date(`${isoDay(now)}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7);
  const end = new Date(start); end.setUTCDate(end.getUTCDate() + 4);
  return { start: isoDay(start), end: isoDay(end) };
}
export function daysAgo(date: string, days: number) {
  const result = new Date(`${date}T00:00:00Z`); result.setUTCDate(result.getUTCDate() - days); return isoDay(result);
}
export function isStale(date: string | null, frequency: Frequency, now = new Date(), toleranceOverride?: number) {
  // Observation dates mark the economic period, not the release timestamp.
  const tolerance = toleranceOverride ?? { daily: 7, weekly: 21, monthly: 80, quarterly: 210 }[frequency];
  return date === null || Date.parse(isoDay(now)) - Date.parse(date) > tolerance * 86400000;
}
export function observationAtOrBefore(observations: Observation[], date: string, toleranceDays: number) {
  const row = observations.find(item => item.date <= date);
  return row && Date.parse(date) - Date.parse(row.date) <= toleranceDays * 86400000 ? row : null;
}
export function monthOffset(date: string, months: number) {
  const result = new Date(`${date.slice(0, 7)}-01T00:00:00Z`); result.setUTCMonth(result.getUTCMonth() + months); return isoDay(result);
}
