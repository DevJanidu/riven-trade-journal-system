import Link from "next/link";
import { Activity, ArrowRight, ArrowUpRight, CalendarDays, Gauge, ListChecks, Plus, Scale, Sparkles, Target, TrendingDown, TrendingUp } from "lucide-react";
import { MonthSelector } from "@/components/ui/month-selector";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";
import { KpiCard, type KpiTone } from "@/components/ui/kpi-card";
import { DirectionBadge, ResultBadge, SessionBadge } from "@/components/ui/badges";
import { CumulativeRChart, DailyPerformanceChart, RDistributionChart, WinRateChart } from "./analytics-charts";
import { SetupPerformance } from "./setup-performance";
import {
  calculateCumulativeR, calculateDailyPerformance, calculateGroupPerformance,
  calculateRDistribution, calculateSetupPerformance, calculateStats,
} from "@/lib/calculations";
import { formatR, formatRR, formatTradeDate, monthLabel } from "@/lib/utils";
import type { Trade } from "@/types/trade";
import { UserGreeting } from "./user-greeting";

export function TradingDashboard({ month, trades, previousNetR, firstName }: { month: string; trades: Trade[]; previousNetR?: number; firstName: string }) {
  const stats = calculateStats(trades);
  const setups = calculateSetupPerformance(trades);
  const sessions = calculateGroupPerformance(trades, "session");
  const directions = calculateGroupPerformance(trades, "direction");
  const bestSetup = setups[0];
  const bestSession = sessions[0];
  const recent = [...trades].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  return <div className="dashboard mx-auto max-w-[1500px] space-y-5 lg:space-y-6">
    <UserGreeting firstName={firstName} />
    <DashboardHeader month={month} />
    {!trades.length ? <EmptyState /> : <>
      <PerformanceMetrics stats={stats} previousNetR={previousNetR} />
      <div className="grid grid-cols-12 gap-5 lg:gap-6">
        <div className="col-span-12 xl:col-span-8"><CumulativeRChart data={calculateCumulativeR(trades)} month={monthLabel(month)} /></div>
        <div className="col-span-12 xl:col-span-4"><PerformanceBreakdown bestSetup={bestSetup} bestSession={bestSession} directions={directions} /></div>
      </div>
      <div className="grid grid-cols-12 gap-5 lg:gap-6">
        <div className="col-span-12 md:col-span-6 xl:col-span-5"><DailyPerformanceChart data={calculateDailyPerformance(trades)} /></div>
        <div className="col-span-12 md:col-span-6 xl:col-span-3"><WinRateChart wins={stats.wins} losses={stats.losses} breakEvens={stats.breakEvens} winRate={stats.winRate} /></div>
        <div className="col-span-12 xl:col-span-4"><RDistributionChart data={calculateRDistribution(trades)} /></div>
      </div>
      <SetupPerformance rows={setups} />
      <MonthlyInsight bestSetup={bestSetup} bestSession={bestSession} sessions={sessions} netR={stats.netR} />
      <RecentTradesTable trades={recent} month={month} />
    </>}
  </div>;
}

function DashboardHeader({ month }: { month: string }) {
  return <header className="flex flex-col gap-5 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-gold">Trading Overview</p>
      <h1 className="mt-1.5 text-[28px] font-semibold tracking-tight text-foreground sm:text-[32px]">{monthLabel(month)}</h1>
      <p className="mt-1 text-sm text-muted">XAUUSD <span className="mx-1.5 text-muted">·</span> Monthly performance</p>
    </div>
    <div className="flex flex-wrap items-center gap-2.5"><MonthSelector month={month} /><ButtonLink href={`/calendar?month=${month}`}><CalendarDays size={16} />Calendar</ButtonLink><ButtonLink href="/journal" variant="primary"><Plus size={16} />Add Trade</ButtonLink></div>
  </header>;
}

type Stats = ReturnType<typeof calculateStats>;
function PerformanceMetrics({ stats, previousNetR }: { stats: Stats; previousNetR?: number }) {
  const comparison = previousNetR === undefined ? null : stats.netR - previousNetR;
  const metrics = [
    { label: "Net R", value: formatR(stats.netR), icon: stats.netR >= 0 ? TrendingUp : TrendingDown, tone: (stats.netR > 0 ? "profit" : stats.netR < 0 ? "loss" : "neutral") as KpiTone, detail: comparison === null ? `${formatR(stats.averageR)} average per trade` : `${comparison >= 0 ? "+" : "−"}${formatR(Math.abs(comparison)).replace("+", "")} vs previous month` },
    { label: "Win rate", value: `${stats.winRate.toFixed(0)}%`, icon: Target, tone: "neutral" as KpiTone, detail: `${stats.wins} wins · ${stats.losses} losses`, progress: stats.winRate },
    { label: "Total trades", value: String(stats.totalTrades), icon: ListChecks, tone: "neutral" as KpiTone, detail: `${stats.breakEvens} break-even` },
    { label: "Average R:R", value: formatRR(stats.averagePlannedRR), icon: Gauge, tone: "neutral" as KpiTone, detail: "Planned reward per unit of risk" },
    { label: "Profit factor", value: stats.profitFactor === null ? "—" : stats.profitFactor.toFixed(2), icon: Scale, tone: "neutral" as KpiTone, detail: "Gross wins ÷ gross losses" },
    { label: "Expectancy", value: formatR(stats.expectancy), icon: Activity, tone: (stats.expectancy > 0 ? "profit" : stats.expectancy < 0 ? "loss" : "neutral") as KpiTone, detail: "Expected R per trade" },
  ];
  return <section aria-labelledby="monthly-performance">
    <h2 id="monthly-performance" className="sr-only">Monthly Performance</h2>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {metrics.map(metric => <KpiCard key={metric.label} {...metric} />)}
    </div>
  </section>;
}

type SetupRow = ReturnType<typeof calculateSetupPerformance>[number];
type GroupRow = ReturnType<typeof calculateGroupPerformance>[number];
function PerformanceBreakdown({ bestSetup, bestSession, directions }: { bestSetup?: SetupRow; bestSession?: GroupRow; directions: GroupRow[] }) {
  return <section className="h-full rounded-[9px] border border-line bg-surface p-5">
    <h2 className="text-sm font-semibold text-foreground">Performance Breakdown</h2>
    <p className="mt-1 text-xs text-muted">Where the month&apos;s edge came from</p>
    <div className="mt-5 space-y-5 divide-y divide-line">
      <div><SectionLabel>Best setup</SectionLabel><div className="mt-2 flex items-end justify-between gap-3"><div><p className="font-medium text-setup">{bestSetup?.setup ?? "—"}</p><p className="mt-1 text-xs text-muted">{bestSetup?.trades ?? 0} trades <span className="mx-1">·</span> {bestSetup?.winRate.toFixed(0) ?? 0}% win rate</p></div><p className="text-lg font-semibold tabular-nums text-accent">{formatR(bestSetup?.netR ?? 0)}</p></div></div>
      <div className="pt-4"><SectionLabel>Best session</SectionLabel><div className="mt-2 flex items-end justify-between"><div><p className="font-medium text-foreground">{bestSession?.name ?? "—"}</p><p className="mt-1 text-xs text-muted">{bestSession?.totalTrades ?? 0} trades this month</p></div><p className="text-lg font-semibold tabular-nums text-foreground">{formatR(bestSession?.netR ?? 0)}</p></div></div>
      <div className="pt-4"><SectionLabel>Long vs short</SectionLabel><div className="mt-3 space-y-2.5">{["Long", "Short"].map(name => { const row = directions.find(item => item.name === name); const netR = row?.netR ?? 0; return <div key={name} className="flex items-center justify-between text-sm"><span className="text-secondary">{name}</span><span className={`font-semibold tabular-nums ${netR < 0 ? "text-loss" : "text-foreground"}`}>{formatR(netR)}</span></div>; })}</div></div>
    </div>
  </section>;
}

function SectionLabel({ children }: { children: React.ReactNode }) { return <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-muted">{children}</p>; }

function MonthlyInsight({ bestSetup, bestSession, sessions, netR }: { bestSetup?: SetupRow; bestSession?: GroupRow; sessions: GroupRow[]; netR: number }) {
  if (!bestSetup || !bestSession) return null;
  const share = netR > 0 && bestSetup.netR > 0 ? Math.round(bestSetup.netR / netR * 100) : null;
  const runnerUp = sessions[1];
  return <section className="flex gap-3 rounded-[9px] border border-line bg-surface-secondary px-4 py-3.5">
    <Sparkles size={15} className="mt-0.5 shrink-0 text-accent" />
    <div><h2 className="text-xs font-semibold uppercase tracking-[.13em] text-secondary">Monthly Insight</h2><p className="mt-1 text-sm leading-6 text-secondary"><span className="font-medium text-setup">{bestSetup.setup}</span> leads your setups at {formatR(bestSetup.netR)}{share !== null ? `, equal to ${share}% of monthly net R` : ""}. {bestSession.name} is your strongest session{runnerUp ? `, ahead of ${runnerUp.name} by ${formatR(bestSession.netR - runnerUp.netR).replace("+", "")}` : ""}.</p></div>
  </section>;
}

function RecentTradesTable({ trades, month }: { trades: Trade[]; month: string }) {
  return <section className="overflow-hidden rounded-[9px] border border-line bg-surface">
    <div className="flex items-center justify-between gap-3 px-5 py-4"><div><h2 className="text-sm font-semibold text-foreground">Recent Trades</h2><p className="mt-1 text-xs text-muted">Latest recorded XAUUSD positions</p></div><Link href={`/trades?month=${month}`} className="focus-ring inline-flex shrink-0 items-center gap-1.5 rounded text-xs font-medium text-accent hover:text-foreground">View All <ArrowRight size={14} /></Link></div>
    <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead><tr className="border-y border-line bg-surface-secondary text-[10px] uppercase tracking-[.13em] text-muted"><th className="px-5 py-2.5 font-medium">Date</th><th className="px-3 py-2.5 font-medium">Session</th><th className="px-3 py-2.5 font-medium">Direction</th><th className="px-3 py-2.5 font-medium">Setup</th><th className="px-3 py-2.5 font-medium">Entry</th><th className="px-3 py-2.5 font-medium">Exit</th><th className="px-3 py-2.5 font-medium">Result</th><th className="px-5 py-2.5 text-right font-medium">R</th></tr></thead><tbody>{trades.map(trade => <tr key={trade.id} className="group relative border-b border-line/70 last:border-0 hover:bg-surface-secondary"><td className="px-5 py-3.5 font-medium text-foreground"><Link href={`/trades/${trade.id}`} className="focus-ring after:absolute after:inset-0">{formatTradeDate(trade.date)}<span className="sr-only">, view trade details</span></Link></td><td className="px-3 py-3.5"><SessionBadge session={trade.session} /></td><td className="px-3 py-3.5"><DirectionBadge direction={trade.direction} /></td><td className="px-3 py-3.5 font-medium text-setup">{trade.setup}</td><td className="px-3 py-3.5 tabular-nums text-muted">{trade.entry.toFixed(2)}</td><td className="px-3 py-3.5 tabular-nums text-muted">{calculateExit(trade).toFixed(2)}</td><td className="px-3 py-3.5"><ResultBadge result={trade.result} /></td><td className={`px-5 py-3.5 text-right font-semibold tabular-nums ${trade.actualR < 0 ? "text-loss" : trade.actualR > 0 ? "text-profit" : "text-secondary"}`}>{formatR(trade.actualR)} <ArrowUpRight size={12} className="ml-1 inline opacity-0 group-hover:opacity-100" /></td></tr>)}</tbody></table></div>
  </section>;
}

function calculateExit(trade: Trade) {
  const riskDistance = Math.abs(trade.entry - trade.stopLoss);
  const direction = trade.direction === "Long" ? 1 : -1;
  return trade.entry + direction * riskDistance * trade.actualR;
}
