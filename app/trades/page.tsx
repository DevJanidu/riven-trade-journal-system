import type { Metadata } from "next";
import { CircleCheckBig, CircleX, ListChecks, Plus, TrendingDown, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { ButtonLink } from "@/components/ui/button";
import { KpiCard } from "@/components/ui/kpi-card";
import { MonthSelector } from "@/components/ui/month-selector";
import { TradesExplorer } from "@/components/trades/trades-explorer";
import { getMonthlyTrades, getTrades } from "@/lib/data/trades";
import { getDrafts } from "@/lib/data/drafts";
import { calculateStats } from "@/lib/trading/calculations";
import { tradeQuerySchema, monthSchema } from "@/lib/validations/trade";
import { formatR, monthLabel } from "@/lib/utils";
import type { TradeFilters } from "@/types/trade";

export const metadata: Metadata = { title: "Trades" };

export default async function TradesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const month = monthSchema.safeParse(params.month).success ? params.month as string : new Date().toISOString().slice(0, 7);
  const parsed = tradeQuerySchema.safeParse(params);
  const filters: TradeFilters = parsed.success ? { ...parsed.data, month } : { month };
  const [monthly, drafts] = await Promise.all([getMonthlyTrades(month), getDrafts(month)]);
  const hasFilters = Boolean(filters.session || filters.setup || filters.result || filters.direction);
  const visible = hasFilters ? await getTrades(filters) : monthly;
  const stats = calculateStats(monthly);

  return <>
    <PageHeader eyebrow="Trade log" title={monthLabel(month)} description="Review every Gold trade and filter the month by the factors that matter." action={<ButtonLink href="/journal" variant="primary"><Plus size={16} />Add Trade</ButtonLink>} />
    <div className="mb-4"><MonthSelector month={month} /></div>
    <section aria-label="Monthly trade summary" className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard icon={ListChecks} value={stats.totalTrades} label="Total trades" detail={`${stats.breakEvens} break-even`} tone="neutral" />
      <KpiCard icon={CircleCheckBig} value={stats.wins} label="Winning trades" detail={`${stats.winRate.toFixed(0)}% win rate`} tone="profit" progress={stats.winRate} />
      <KpiCard icon={CircleX} value={stats.losses} label="Losing trades" detail={`${stats.totalTrades ? Math.round(stats.losses / stats.totalTrades * 100) : 0}% of all trades`} tone="loss" progress={stats.totalTrades ? stats.losses / stats.totalTrades * 100 : 0} />
      <KpiCard icon={stats.netR >= 0 ? TrendingUp : TrendingDown} value={formatR(stats.netR)} label="Net performance" detail={`${formatR(stats.averageR)} average per trade`} tone={stats.netR >= 0 ? "profit" : "loss"} />
    </section>
    <TradesExplorer key={JSON.stringify(filters)} initialTrades={visible} initialDrafts={drafts} month={month} initialFilters={filters} />
  </>;
}
