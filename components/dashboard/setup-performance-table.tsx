"use client";

import { useState } from "react";
import { Pagination } from "@/components/ui/pagination";
import { formatR } from "@/lib/utils";

type Row = { setup: string; trades: number; winRate: number; netR: number };
const PAGE_SIZE = 10;

export function SetupPerformanceTable({ rows }: { rows: Row[] }) {
  const [page, setPage] = useState(1);
  const lastPage = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, lastPage);
  const visibleRows = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return <div>
    <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm"><thead><tr className="border-b border-line text-[11px] uppercase tracking-[.12em] text-muted"><th className="px-5 py-3 font-medium">Setup</th><th className="px-4 py-3 font-medium">Trades</th><th className="px-4 py-3 font-medium">Win Rate</th><th className="px-5 py-3 text-right font-medium">Net R</th></tr></thead><tbody>{visibleRows.map(row => <tr key={row.setup} className="border-b border-line/70 last:border-0"><td className="px-5 py-3.5 font-medium text-setup">{row.setup}</td><td className="px-4 py-3.5 text-muted">{row.trades}</td><td className="px-4 py-3.5 text-muted">{Math.round(row.winRate)}%</td><td className={row.netR >= 0 ? "px-5 py-3.5 text-right font-mono text-profit" : "px-5 py-3.5 text-right font-mono text-loss"}>{formatR(row.netR)}</td></tr>)}</tbody></table></div>
    <Pagination currentPage={safePage} totalItems={rows.length} pageSize={PAGE_SIZE} onPageChange={setPage} itemLabel="setups" />
  </div>;
}
