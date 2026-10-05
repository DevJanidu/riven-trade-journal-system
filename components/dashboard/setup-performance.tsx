"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { ThemedSelect } from "@/components/ui/themed-select";
import { Pagination } from "@/components/ui/pagination";
import { formatR } from "@/lib/utils";

type SetupRow = { setup: string; trades: number; winRate: number; netR: number };
type SortKey = "netR" | "winRate" | "trades";
const PAGE_SIZE = 5;

export function SetupPerformance({ rows }: { rows: SetupRow[] }) {
  const [sortBy, setSortBy] = useState<SortKey>("netR");
  const [page, setPage] = useState(1);
  const sorted = useMemo(() => [...rows].sort((a, b) => b[sortBy] - a[sortBy] || a.setup.localeCompare(b.setup)), [rows, sortBy]);
  const lastPage = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, lastPage);
  const visibleRows = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const bestNetR = Math.max(0, ...rows.map(row => row.netR));
  const range = Math.max(1, ...rows.map(row => Math.abs(row.netR)));
  return <section className="rounded-[9px] border border-line bg-surface">
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"><div><h2 className="text-sm font-semibold text-foreground">Setup Performance</h2><p className="mt-1 text-xs text-muted">Compare the playbook by outcome</p></div><ThemedSelect variant="inline" label="Sort by" value={sortBy} onValueChange={next => { setSortBy(next as SortKey); setPage(1); }} options={[{ value: "netR", label: "Net R" }, { value: "winRate", label: "Win Rate" }, { value: "trades", label: "Trades" }]} /></div>
    <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead><tr className="border-y border-line bg-surface-secondary text-[10px] uppercase tracking-[.13em] text-muted"><th className="px-5 py-2.5 font-medium">Setup</th><th className="px-3 py-2.5 font-medium">Trades</th><th className="px-3 py-2.5 font-medium">Win Rate</th><th className="px-5 py-2.5 text-right font-medium">Net R</th></tr></thead><tbody>{visibleRows.map(row => <tr key={row.setup} className={`border-b border-line/70 last:border-0 ${row.netR === bestNetR && bestNetR > 0 ? "bg-accent/[.035]" : ""}`}><td className="px-5 py-3 font-medium text-setup">{row.setup}{row.netR === bestNetR && bestNetR > 0 && <span className="ml-2 text-[10px] uppercase tracking-wider text-accent">Best</span>}</td><td className="px-3 py-3 tabular-nums text-secondary">{row.trades}</td><td className="px-3 py-3 tabular-nums text-secondary">{row.winRate.toFixed(0)}%</td><td className="w-[220px] px-5 py-3"><div className="flex items-center justify-end gap-3"><div className="h-4 w-24" aria-hidden="true"><ResponsiveContainer width="100%" height="100%"><BarChart layout="vertical" data={[row]} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}><XAxis type="number" domain={[-range, range]} hide /><YAxis type="category" dataKey="setup" hide /><ReferenceLine x={0} stroke="var(--chart-zero)" /><Bar dataKey="netR" fill={row.netR < 0 ? "var(--chart-loss)" : row.netR > 0 ? "var(--chart-profit)" : "var(--muted)"} fillOpacity={0.75} barSize={5} isAnimationActive={false} /></BarChart></ResponsiveContainer></div><span className={`w-14 text-right font-semibold tabular-nums ${row.netR < 0 ? "text-loss" : row.netR > 0 ? "text-profit" : "text-secondary"}`}>{formatR(row.netR)}</span></div></td></tr>)}</tbody></table></div>
    <Pagination currentPage={safePage} totalItems={sorted.length} pageSize={PAGE_SIZE} onPageChange={setPage} itemLabel="setups" />
  </section>;
}
