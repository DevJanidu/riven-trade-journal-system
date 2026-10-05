"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, CircleCheckBig, CircleX, ListChecks, Plus, TrendingDown, TrendingUp, X } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button, ButtonLink } from "@/components/ui/button";
import { KpiCard } from "@/components/ui/kpi-card";
import { MonthSelector } from "@/components/ui/month-selector";
import { Spinner } from "@/components/ui/spinner";
import { calculateStats } from "@/lib/trading/calculations";
import { tradeQuerySchema } from "@/lib/validations/trade";
import { formatR, formatTradeDate, monthLabel } from "@/lib/utils";
import type { ApiResponse, Trade, TradeFilters } from "@/types/trade";
import type { TradeDraft } from "@/lib/validations/draft";
import { TradesExplorer } from "./trades-explorer";

type MonthData = { trades: Trade[]; drafts: TradeDraft[] };
type Props = { month: string; initialFilters: TradeFilters; summaryTrades: Trade[]; initialTrades: Trade[]; initialDrafts: TradeDraft[] };

async function fetchData<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal, cache: "no-store" });
  const json: ApiResponse<T> = await response.json();
  if (!response.ok || !json.success) throw new Error(json.success ? "Unable to load monthly trades" : typeof json.error === "string" ? json.error : "Unable to load monthly trades");
  return json.data;
}

export function TradesView({ month, initialFilters, summaryTrades, initialTrades, initialDrafts }: Props) {
  const [clearedFilters, setClearedFilters] = useState<TradeFilters | null>(null);
  const [monthly, setMonthly] = useState<MonthData | null>(null);
  const [monthError, setMonthError] = useState("");
  const deletedItems = useRef(new Set<string>());
  const date = clearedFilters ? undefined : initialFilters.date;
  const filters = clearedFilters ?? initialFilters;

  const loadMonth = useCallback(async (signal?: AbortSignal) => {
    try {
      const [trades, drafts] = await Promise.all([
        fetchData<Trade[]>(`/api/trades?month=${month}`, signal),
        fetchData<TradeDraft[]>(`/api/drafts?month=${month}`, signal),
      ]);
      if (!signal?.aborted) {
        setMonthly({ trades: trades.filter(trade => !deletedItems.current.has(`trade:${trade.id}`)), drafts: drafts.filter(draft => !deletedItems.current.has(`draft:${draft.id}`)) });
        setMonthError("");
      }
    } catch (error) {
      if (!signal?.aborted) setMonthError(error instanceof Error ? error.message : "Unable to load monthly trades");
    }
  }, [month]);

  useEffect(() => {
    if (!initialFilters.date) return;
    // Prepare only this user's selected month while they review the daily log.
    const controller = new AbortController();
    const timer = window.setTimeout(() => { void loadMonth(controller.signal); }, 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [initialFilters.date, loadMonth]);

  function clearDate() {
    const query = new URLSearchParams(window.location.search);
    query.delete("date");
    query.set("month", month);
    const parsed = tradeQuerySchema.safeParse(Object.fromEntries(query));
    setClearedFilters(parsed.success ? { ...parsed.data, month } : { month });
    window.history.replaceState(null, "", `/trades?${query}`);
    if (monthError) { setMonthError(""); void loadMonth(); }
  }

  function onDeleted(id: string, kind: "trade" | "draft") {
    deletedItems.current.add(`${kind}:${id}`);
    setMonthly(current => current ? {
      trades: kind === "trade" ? current.trades.filter(trade => trade.id !== id) : current.trades,
      drafts: kind === "draft" ? current.drafts.filter(draft => draft.id !== id) : current.drafts,
    } : null);
  }

  const cleared = Boolean(clearedFilters);
  const loading = cleared && !monthly;
  const summary = cleared ? monthly?.trades ?? [] : summaryTrades;
  const stats = calculateStats(summary);
  const visible = cleared ? (monthly?.trades ?? []).filter(trade =>
    (!filters.session || trade.session === filters.session) && (!filters.setup || trade.setup === filters.setup) &&
    (!filters.result || trade.result === filters.result) && (!filters.direction || trade.direction === filters.direction)) : initialTrades;

  return <>
    {date && <Link href={`/calendar?month=${month}`} prefetch={false} className="focus-ring mb-4 inline-flex items-center gap-2 rounded text-sm text-muted hover:text-foreground"><ArrowLeft size={15} />Back to Calendar</Link>}
    <PageHeader eyebrow="Trade log" title={date ? `Trades — ${formatTradeDate(date, "long")}` : monthLabel(month)} description={date ? "Review your XAUUSD trades taken on this date." : "Review every Gold trade and filter the month by the factors that matter."} action={<ButtonLink href="/journal" variant="primary"><Plus size={16} />Add Trade</ButtonLink>} />
    <div className="mb-4">{date ? <button type="button" onClick={clearDate} aria-label="Remove date filter" className="focus-ring inline-flex items-center gap-2 rounded-md border border-line bg-surface px-3 py-2 text-xs text-foreground hover:border-accent/30">{formatTradeDate(date, "long")}<X size={13} /></button> : <MonthSelector month={month} />}</div>
    {loading ? <div aria-live="polite" role={monthError ? "alert" : "status"} className="flex min-h-52 flex-col items-center justify-center gap-3 rounded-lg border border-line bg-surface text-sm text-muted">
      {monthError ? <><p>{monthError}</p><Button type="button" onClick={() => { setMonthError(""); void loadMonth(); }}>Retry</Button></> : <><Spinner label="Loading monthly trades" /><p>Loading monthly trades…</p></>}
    </div> : <>
      <section aria-label={date ? "Daily trade summary" : "Monthly trade summary"} className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon={ListChecks} value={stats.totalTrades} label="Total trades" detail={`${stats.breakEvens} break-even`} tone="neutral" />
        <KpiCard icon={CircleCheckBig} value={stats.wins} label="Winning trades" detail={`${stats.winRate.toFixed(0)}% win rate`} tone="profit" progress={stats.winRate} />
        <KpiCard icon={CircleX} value={stats.losses} label="Losing trades" detail={`${stats.totalTrades ? Math.round(stats.losses / stats.totalTrades * 100) : 0}% of all trades`} tone="loss" progress={stats.totalTrades ? stats.losses / stats.totalTrades * 100 : 0} />
        <KpiCard icon={stats.netR >= 0 ? TrendingUp : TrendingDown} value={formatR(stats.netR)} label="Net performance" detail={`${formatR(stats.averageR)} average per trade`} tone={stats.netR >= 0 ? "profit" : "loss"} />
      </section>
      <TradesExplorer key={JSON.stringify(filters)} initialTrades={visible} initialDrafts={cleared ? monthly?.drafts ?? [] : initialDrafts} month={month} initialFilters={filters} onItemDeleted={onDeleted} />
    </>}
  </>;
}
