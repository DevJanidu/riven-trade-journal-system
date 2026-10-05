import type { Metadata } from "next";
import { Activity, CircleCheckBig, DollarSign, ListChecks } from "lucide-react";
import { ReportControls } from "@/components/reports/report-controls";
import { KpiCard } from "@/components/ui/kpi-card";
import { PageHeader } from "@/components/ui/page-header";
import { getTradesForRange } from "@/lib/data/trades";
import { getReportBreakdown, getReportRange, reportQuerySchema } from "@/lib/reports";
import { calculateStats } from "@/lib/trading/calculations";
import { formatMoney, formatR, formatTradeDate } from "@/lib/utils";
import { paginate, parsePage } from "@/lib/pagination";
import { UrlPagination } from "@/components/ui/url-pagination";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const query = reportQuerySchema.safeParse({ period: typeof raw.period === "string" ? raw.period : undefined, date: typeof raw.date === "string" ? raw.date : undefined });
  const { period, date } = query.success ? query.data : reportQuerySchema.parse({});
  const range = getReportRange(period, date);
  const trades = await getTradesForRange(range.start, range.endExclusive);
  const stats = calculateStats(trades);
  const netProfitLoss = trades.reduce((sum, trade) => sum + trade.profitLoss, 0);
  const breakdown = getReportBreakdown(trades);
  const tradePagination = paginate(trades.length, parsePage(raw.tradePage));
  const setupPagination = paginate(breakdown.length, parsePage(raw.setupPage), 5);
  const visibleTrades = trades.slice(tradePagination.offset, tradePagination.end);
  const visibleBreakdown = breakdown.slice(setupPagination.offset, setupPagination.end);

  return <div className="mx-auto max-w-[1500px] space-y-5">
    <PageHeader eyebrow="Performance reports" title={range.label} description="Review your results by week, month, or year and export the complete report to Excel." />
    <ReportControls period={period} date={date} hasTrades={trades.length > 0} />
    <section aria-label="Report summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard icon={ListChecks} value={stats.totalTrades} label="Total trades" detail={`${stats.wins} wins · ${stats.losses} losses`} />
      <KpiCard icon={CircleCheckBig} value={`${stats.winRate.toFixed(1)}%`} label="Win rate" detail={`${stats.breakEvens} break-even`} tone="profit" progress={stats.winRate} />
      <KpiCard icon={Activity} value={formatR(stats.netR)} label="Net performance" detail={`${formatR(stats.averageR)} average per trade`} tone={stats.netR >= 0 ? "profit" : "loss"} />
      <KpiCard icon={DollarSign} value={formatMoney(netProfitLoss)} label="Net P&L" detail={`Profit factor ${stats.profitFactor === null ? "—" : stats.profitFactor.toFixed(2)}`} tone={netProfitLoss >= 0 ? "profit" : "loss"} />
    </section>
    {!trades.length ? <div className="grid min-h-64 place-items-center rounded-[10px] border border-dashed border-line bg-surface p-8 text-center"><div><h2 className="font-semibold text-foreground">No trades in this period</h2><p className="mt-2 text-sm text-muted">Choose another date or report period to view results.</p></div></div> : <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,.55fr)]">
      <section className="overflow-hidden rounded-[10px] border border-line bg-surface"><div className="border-b border-line px-5 py-4"><h2 className="text-sm font-semibold text-foreground">Trades</h2><p className="mt-1 text-xs text-muted">{range.start} to {range.endInclusive}</p></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b border-line text-[11px] uppercase tracking-[.12em] text-muted"><th className="px-5 py-3 font-medium">Date</th><th className="px-4 py-3 font-medium">Session</th><th className="px-4 py-3 font-medium">Setup</th><th className="px-4 py-3 font-medium">Result</th><th className="px-4 py-3 text-right font-medium">R</th><th className="px-5 py-3 text-right font-medium">P&amp;L</th></tr></thead><tbody>{visibleTrades.map(trade => <tr key={trade.id} className="border-b border-line/70 last:border-0"><td className="px-5 py-3.5 text-foreground">{formatTradeDate(trade.date)}</td><td className="px-4 py-3.5 text-muted">{trade.session}</td><td className="px-4 py-3.5 font-medium text-setup">{trade.setup}</td><td className="px-4 py-3.5 text-muted">{trade.result}</td><td className={`px-4 py-3.5 text-right font-mono ${trade.actualR >= 0 ? "text-profit" : "text-loss"}`}>{formatR(trade.actualR)}</td><td className={`px-5 py-3.5 text-right font-mono ${trade.profitLoss >= 0 ? "text-profit" : "text-loss"}`}>{formatMoney(trade.profitLoss)}</td></tr>)}</tbody></table></div><UrlPagination currentPage={tradePagination.page} totalItems={trades.length} pageParameter="tradePage" itemLabel="report trades" /></section>
      <section className="overflow-hidden rounded-[10px] border border-line bg-surface"><div className="border-b border-line px-5 py-4"><h2 className="text-sm font-semibold text-foreground">Setup breakdown</h2><p className="mt-1 text-xs text-muted">Performance grouped by strategy</p></div><div className="overflow-x-auto"><table className="w-full min-w-[440px] text-left text-sm"><thead><tr className="border-b border-line text-[11px] uppercase tracking-[.12em] text-muted"><th className="px-5 py-3 font-medium">Setup</th><th className="px-3 py-3 font-medium">Trades</th><th className="px-3 py-3 font-medium">Win rate</th><th className="px-5 py-3 text-right font-medium">Net R</th></tr></thead><tbody>{visibleBreakdown.map(row => <tr key={row.setup} className="border-b border-line/70 last:border-0"><td className="px-5 py-3.5 font-medium text-setup">{row.setup}</td><td className="px-3 py-3.5 text-muted">{row.trades}</td><td className="px-3 py-3.5 text-muted">{row.winRate.toFixed(0)}%</td><td className={`px-5 py-3.5 text-right font-mono ${row.netR >= 0 ? "text-profit" : "text-loss"}`}>{formatR(row.netR)}</td></tr>)}</tbody></table></div><UrlPagination currentPage={setupPagination.page} totalItems={breakdown.length} pageSize={5} pageParameter="setupPage" itemLabel="setups" /></section>
    </div>}
  </div>;
}
