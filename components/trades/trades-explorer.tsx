"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MonthPicker } from "@/components/ui/calendar-picker";
import { ThemedSelect } from "@/components/ui/themed-select";
import { EmptyState } from "@/components/ui/empty-state";
import { directions, results, sessions, setups, type ApiResponse, type Trade, type TradeFilters } from "@/types/trade";
import type { TradeDraft } from "@/lib/validations/draft";
import { TradeTable } from "./trade-table";
import { Spinner } from "@/components/ui/spinner";
import { paginate } from "@/lib/pagination";

type FilterKey = "session" | "setup" | "result" | "direction";
type Props = { initialTrades: Trade[]; initialDrafts: TradeDraft[]; month: string; initialPage?: number; initialFilters: TradeFilters; onItemDeleted?: (id: string, kind: "trade" | "draft") => void };
const PAGE_SIZE = 10;

export function TradesExplorer({ initialTrades, initialDrafts, month, initialPage = 1, initialFilters, onItemDeleted }: Props) {
  const router = useRouter();
  const [filters, setFilters] = useState<TradeFilters>(initialFilters);
  const [trades, setTrades] = useState(initialTrades);
  const [drafts, setDrafts] = useState(initialDrafts);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(initialPage);
  const shownDrafts = drafts.filter(draft => !filters.date && !filters.result && (!filters.session || draft.data.session === filters.session) && (!filters.setup || draft.data.setup === filters.setup) && (!filters.direction || draft.data.direction === filters.direction));
  const shownCount = trades.length + shownDrafts.length;
  const safePage = paginate(shownCount, page, PAGE_SIZE).page;

  useEffect(() => {
    const query = new URLSearchParams({ month });
    if (filters.date) query.set("date", filters.date);
    for (const key of ["session", "setup", "result", "direction"] as const) if (filters[key]) query.set(key, filters[key]);
    query.set("page", String(safePage));
    window.history.replaceState(null, "", `/trades?${query}`);
  }, [filters, month, safePage]);

  useEffect(() => {
    const query = new URLSearchParams({ month });
    if (filters.date) query.set("date", filters.date);
    for (const key of ["session", "setup", "result", "direction"] as const) if (filters[key]) query.set(key, filters[key]);
    const initialQuery = new URLSearchParams({ month });
    if (initialFilters.date) initialQuery.set("date", initialFilters.date);
    for (const key of ["session", "setup", "result", "direction"] as const) if (initialFilters[key]) initialQuery.set(key, initialFilters[key]);
    if (query.toString() === initialQuery.toString()) return;
    const controller = new AbortController();
    fetch(`/api/trades?${query}`, { signal: controller.signal })
      .then(async response => { const json: ApiResponse<Trade[]> = await response.json(); if (!response.ok || !json.success) throw new Error(json.success ? "Unable to load trades" : json.error); return json.data; })
      .then(setTrades)
      .catch(cause => { if (cause.name !== "AbortError") setError(cause.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [filters, initialFilters, month]);

  function select(key: FilterKey, value: string) {
    const next = { ...filters, [key]: value === "All" ? undefined : value };
    const keys = ["session", "setup", "result", "direction"] as const;
    const isInitial = keys.every(item => next[item] === initialFilters[item]);
    setLoading(!isInitial);
    setPage(1);
    setError("");
    if (isInitial) setTrades(initialTrades);
    setFilters(next);
  }

  function changeMonth(next: string) {
    const query = new URLSearchParams({ month: next });
    for (const key of ["session", "setup", "result", "direction"] as const) if (filters[key]) query.set(key, filters[key]);
    router.push(`/trades?${query}`);
  }

  function onDeleted(id: string, kind: "trade" | "draft") {
    onItemDeleted?.(id, kind);
    if (kind === "draft") setDrafts(current => current.filter(item => item.id !== id));
    else setTrades(current => current.filter(item => item.id !== id));
  }

  const filtered = Boolean(filters.session || filters.setup || filters.result || filters.direction);

  return <>
    <div className="mb-4 grid gap-3 rounded-[9px] border border-line bg-surface p-4 sm:grid-cols-2 xl:grid-cols-5">
      <MonthPicker value={month} onChange={changeMonth} />
      <ThemedSelect variant="filter" label="Session" options={["All", ...sessions]} value={filters.session ?? "All"} onValueChange={value => select("session", value)} />
      <ThemedSelect variant="filter" label="Setup" options={["All", ...setups]} value={filters.setup ?? "All"} onValueChange={value => select("setup", value)} tone={filters.setup ? "setup" : "default"} />
      <ThemedSelect variant="filter" label="Result" options={["All", ...results]} value={filters.result ?? "All"} onValueChange={value => select("result", value)} />
      <ThemedSelect variant="filter" label="Direction" options={["All", ...directions]} value={filters.direction ?? "All"} onValueChange={value => select("direction", value)} />
    </div>
    {error ? <div role="alert" className="border border-loss/40 bg-loss/5 p-5 text-sm text-loss">{error}</div>
      : loading ? <div className="flex min-h-52 items-center justify-center gap-2 border border-line bg-surface p-5 text-sm text-muted"><Spinner label="Loading trades" />Loading trades…</div>
        : shownCount ? <div className="border border-line bg-surface">
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5"><p className="text-sm font-medium text-foreground">All trades</p><p className="text-xs text-muted">{shownCount} shown{shownDrafts.length ? ` · ${shownDrafts.length} draft${shownDrafts.length === 1 ? "" : "s"}` : ""}</p></div>
          <TradeTable trades={trades} drafts={shownDrafts} page={safePage} pageSize={PAGE_SIZE} onPageChange={setPage} onDeleted={onDeleted} />
        </div> : filtered ? <div className="grid min-h-52 place-items-center border border-dashed border-line bg-surface p-8 text-center text-sm text-muted">No trades match these filters.</div> : <EmptyState />}
  </>;
}
