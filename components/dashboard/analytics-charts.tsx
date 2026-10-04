"use client";

import { useState } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { formatR } from "@/lib/utils";

const colors = { teal: "var(--teal)", loss: "var(--red)", line: "var(--border)", muted: "var(--muted)" };
type CurvePoint = { trade: number; date: string; label: string; value: number; dailyR: number; tradeR: number };
type DailyPoint = { date: string; label: string; trades: number; value: number };
type HistogramPoint = { label: string; count: number };
type TipProps<T> = { active?: boolean; payload?: Array<{ payload?: T }> };

function ChartCard({ title, subtitle, children, control }: { title: string; subtitle: string; children: React.ReactNode; control?: React.ReactNode }) {
  return <section className="h-full rounded-[9px] border border-line bg-surface p-4 sm:p-5">
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-sm font-semibold text-white">{title}</h2><p className="mt-1 text-xs text-muted">{subtitle}</p></div>{control}</div>
    {children}
  </section>;
}

function TooltipShell({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-[#30404e] bg-[#141e28] px-3 py-2.5 text-xs shadow-xl shadow-black/30">{children}</div>;
}

function CurveTooltip({ active, payload }: TipProps<CurvePoint>) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return <TooltipShell><p className="font-medium text-white">{point.label}</p><p className="mt-1 text-muted">Trade #{point.trade}</p><p className={`mt-2 font-semibold tabular-nums ${point.tradeR < 0 ? "text-loss" : "text-accent"}`}>{formatR(point.tradeR)}</p><p className="mt-1 text-[#b8c6d2]">Cumulative: <span className="font-semibold text-white">{formatR(point.value)}</span></p></TooltipShell>;
}

type DailyCurvePoint = CurvePoint & { trades: number };
function DailyCurveTooltip({ active, payload }: TipProps<DailyCurvePoint>) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return <TooltipShell><p className="font-medium text-white">{point.label}</p><p className="mt-1 text-muted">{point.trades} {point.trades === 1 ? "trade" : "trades"}</p><p className={`mt-2 font-semibold tabular-nums ${point.dailyR < 0 ? "text-loss" : "text-accent"}`}>{formatR(point.dailyR)} daily</p></TooltipShell>;
}

export function CumulativeRChart({ data, month }: { data: CurvePoint[]; month: string }) {
  const [mode, setMode] = useState<"cumulative" | "daily">("cumulative");
  const cumulative = mode === "cumulative";
  const daily = [...data.reduce((days, point) => {
    const previous = days.get(point.date);
    days.set(point.date, { ...point, dailyR: Number(((previous?.dailyR ?? 0) + point.tradeR).toFixed(2)), trades: (previous?.trades ?? 0) + 1 });
    return days;
  }, new Map<string, DailyCurvePoint>()).values()];
  return <ChartCard title="Cumulative R" subtitle={`Performance across ${month}`} control={<div className="inline-flex rounded-md border border-line bg-[#0a1016] p-0.5" role="group" aria-label="Chart view"><button type="button" onClick={() => setMode("cumulative")} aria-pressed={cumulative} className={`focus-ring rounded px-2.5 py-1.5 text-[11px] font-medium ${cumulative ? "bg-[#1c2b35] text-white" : "text-muted hover:text-white"}`}>Cumulative R</button><button type="button" onClick={() => setMode("daily")} aria-pressed={!cumulative} className={`focus-ring rounded px-2.5 py-1.5 text-[11px] font-medium ${!cumulative ? "bg-[#1c2b35] text-white" : "text-muted hover:text-white"}`}>Daily R</button></div>}>
    <div className="h-[300px] w-full sm:h-[330px]"><ResponsiveContainer width="100%" height="100%"><AreaChart data={cumulative ? [{ trade: 0, date: "", label: "Start", value: 0, dailyR: 0, tradeR: 0 }, ...data] : daily} margin={{ top: 14, right: 6, left: -15, bottom: 2 }}>
      <defs><linearGradient id="cumulative-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={colors.teal} stopOpacity={0.14} /><stop offset="100%" stopColor={colors.teal} stopOpacity={0} /></linearGradient></defs>
      <CartesianGrid vertical={false} stroke={colors.line} strokeOpacity={0.7} strokeDasharray="2 5" />
      <XAxis dataKey="label" minTickGap={28} tick={{ fill: colors.muted, fontSize: 11 }} tickLine={false} axisLine={false} dy={8} />
      <YAxis tickFormatter={(value: number) => `${value}R`} tick={{ fill: colors.muted, fontSize: 11 }} tickLine={false} axisLine={false} width={45} />
      <ReferenceLine y={0} stroke="var(--muted)" strokeDasharray="3 4" />
      <Tooltip cursor={{ stroke: "var(--muted)", strokeDasharray: "3 4" }} content={cumulative ? <CurveTooltip /> : <DailyCurveTooltip />} />
      <Area type="linear" dataKey={cumulative ? "value" : "dailyR"} stroke={colors.teal} strokeWidth={1.8} fill="url(#cumulative-fill)" dot={false} activeDot={{ r: 3.5, stroke: "var(--surface)", strokeWidth: 2 }} isAnimationActive={false} />
    </AreaChart></ResponsiveContainer></div>
  </ChartCard>;
}

function DailyTooltip({ active, payload }: TipProps<DailyPoint>) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return <TooltipShell><p className="font-medium text-white">{point.label}</p><p className="mt-1 text-muted">{point.trades} {point.trades === 1 ? "trade" : "trades"}</p><p className={`mt-2 font-semibold tabular-nums ${point.value < 0 ? "text-loss" : "text-accent"}`}>{formatR(point.value)}</p></TooltipShell>;
}

export function DailyPerformanceChart({ data }: { data: DailyPoint[] }) {
  return <ChartCard title="Daily Performance" subtitle="Net R by trading day"><div className="h-[205px] w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={data} margin={{ top: 8, right: 4, left: -18, bottom: 0 }} barCategoryGap="28%">
    <CartesianGrid vertical={false} stroke={colors.line} strokeOpacity={0.55} strokeDasharray="2 5" />
    <XAxis dataKey="label" minTickGap={20} tickFormatter={(value: string) => value.split(" ").at(-1) ?? value} tick={{ fill: colors.muted, fontSize: 10 }} tickLine={false} axisLine={false} dy={7} />
    <YAxis tickFormatter={(value: number) => `${value}R`} tick={{ fill: colors.muted, fontSize: 10 }} tickLine={false} axisLine={false} width={40} />
    <ReferenceLine y={0} stroke="var(--muted)" />
    <Tooltip cursor={{ fill: "color-mix(in srgb, var(--foreground) 4%, transparent)" }} content={<DailyTooltip />} />
    <Bar dataKey="value" radius={[2, 2, 0, 0]} isAnimationActive={false}>{data.map((point, index) => <Cell key={index} fill={point.value < 0 ? colors.loss : colors.teal} fillOpacity={0.8} />)}</Bar>
  </BarChart></ResponsiveContainer></div></ChartCard>;
}

export function WinRateChart({ wins, losses, breakEvens, winRate }: { wins: number; losses: number; breakEvens: number; winRate: number }) {
  const data = [{ name: "Wins", value: wins, color: colors.teal }, { name: "Losses", value: losses, color: colors.loss }, ...(breakEvens ? [{ name: "Break Even", value: breakEvens, color: "var(--muted)" }] : [])];
  return <ChartCard title="Win / Loss" subtitle="Trade outcome distribution"><div className="relative mx-auto h-[155px] w-full max-w-[220px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data} dataKey="value" nameKey="name" innerRadius="67%" outerRadius="83%" paddingAngle={2} stroke="none" isAnimationActive={false}>{data.map(item => <Cell key={item.name} fill={item.color} />)}</Pie><Tooltip formatter={(value, name) => [`${value} trades`, name]} contentStyle={{ background: "var(--surface-raised)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--foreground)", fontSize: 12 }} /></PieChart></ResponsiveContainer><div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><span className="text-[27px] font-semibold tabular-nums tracking-tight text-white">{winRate.toFixed(0)}%</span><span className="text-[10px] uppercase tracking-[.12em] text-muted">Win Rate</span></div></div><div className="mt-1 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs"><span className="text-muted"><i className="mr-1.5 inline-block size-1.5 rounded-full bg-accent align-middle" /><strong className="tabular-nums text-white">{wins}</strong> Wins</span><span className="text-muted"><i className="mr-1.5 inline-block size-1.5 rounded-full bg-loss align-middle" /><strong className="tabular-nums text-white">{losses}</strong> Losses</span>{breakEvens > 0 && <span className="text-muted">{breakEvens} BE</span>}</div></ChartCard>;
}

function DistributionTooltip({ active, payload }: TipProps<HistogramPoint>) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return <TooltipShell><p className="font-medium text-white">{point.label}</p><p className="mt-1 text-muted">{point.count} {point.count === 1 ? "trade" : "trades"}</p></TooltipShell>;
}

export function RDistributionChart({ data }: { data: HistogramPoint[] }) {
  return <ChartCard title="R Distribution" subtitle="Where trade outcomes land"><div className="h-[205px] w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={data} margin={{ top: 8, right: 2, left: -23, bottom: 0 }} barCategoryGap="24%">
    <CartesianGrid vertical={false} stroke={colors.line} strokeOpacity={0.55} strokeDasharray="2 5" />
    <XAxis dataKey="label" tick={{ fill: colors.muted, fontSize: 9 }} tickLine={false} axisLine={false} interval={0} dy={7} />
    <YAxis allowDecimals={false} tick={{ fill: colors.muted, fontSize: 10 }} tickLine={false} axisLine={false} width={30} />
    <Tooltip cursor={{ fill: "color-mix(in srgb, var(--foreground) 4%, transparent)" }} content={<DistributionTooltip />} />
    <Bar dataKey="count" radius={[2, 2, 0, 0]} isAnimationActive={false}>{data.map((point, index) => <Cell key={point.label} fill={index < 2 ? colors.loss : colors.teal} fillOpacity={index < 2 ? 0.68 : 0.75} />)}</Bar>
  </BarChart></ResponsiveContainer></div></ChartCard>;
}
