import Link from "next/link";
import { ArrowUpRight, Pencil } from "lucide-react";
import type { Trade } from "@/types/trade";
import type { TradeDraft } from "@/lib/validations/draft";
import { formatR, formatTradeDate } from "@/lib/utils";
import { DirectionBadge, ResultBadge, SessionBadge } from "@/components/ui/badges";
import { Pagination } from "@/components/ui/pagination";
import { DeleteConfirmation } from "./delete-confirmation";

type Props = {
  trades: Trade[];
  drafts?: TradeDraft[];
  compact?: boolean;
  onDeleted?: (id: string, kind: "trade" | "draft") => void;
  page?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
};

export function TradeTable({ trades, drafts = [], compact = false, onDeleted, page = 1, pageSize = 10, onPageChange }: Props) {
  const rows = [
    ...trades.map(trade => ({ kind: "trade" as const, date: trade.date, id: trade.id, trade })),
    ...drafts.map(draft => ({ kind: "draft" as const, date: draft.date, id: draft.id, draft })),
  ].sort((a, b) => b.date.localeCompare(a.date));
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const visibleRows = rows.slice((safePage - 1) * pageSize, safePage * pageSize);

  return <><div className="overflow-x-auto"><table className="w-full min-w-[950px] text-left text-sm">
    <thead><tr className="border-b border-line text-[11px] uppercase tracking-[.12em] text-muted">
      <th className="px-5 py-3 font-medium">Date</th><th className="px-3 py-3 font-medium">Session</th><th className="px-3 py-3 font-medium">Direction</th><th className="px-3 py-3 font-medium">Setup</th>
      {!compact && <th className="px-3 py-3 font-medium">Entry</th>}<th className="px-3 py-3 font-medium">Result</th><th className="px-3 py-3 text-right font-medium">R</th><th className="px-5 py-3 text-right font-medium">Actions</th>
    </tr></thead>
    <tbody>{visibleRows.map(row => row.kind === "trade"
      ? <TradeRow key={row.id} trade={row.trade} compact={compact} onDeleted={onDeleted} />
      : <DraftRow key={row.id} draft={row.draft} compact={compact} onDeleted={onDeleted} />)}</tbody>
  </table></div>{onPageChange && <Pagination currentPage={safePage} totalItems={rows.length} pageSize={pageSize} onPageChange={onPageChange} itemLabel="trades" />}</>;
}

function Actions({ id, month, kind, onDeleted }: { id: string; month: string; kind: "trade" | "draft"; onDeleted?: Props["onDeleted"] }) {
  const href = kind === "draft" ? `/journal?draft=${id}` : `/trades/${id}/edit`;
  return <div className="flex items-center justify-end gap-2">
    <Link href={href} aria-label={`Edit ${kind}`} className="focus-ring inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-surface-raised px-2.5 text-xs font-semibold text-foreground hover:border-[#34434f] hover:bg-[#15212b]"><Pencil size={13} />Edit</Link>
    <DeleteConfirmation tradeId={id} month={month} kind={kind} compact onDeleted={onDeleted ? deletedId => onDeleted(deletedId, kind) : undefined} />
  </div>;
}

function TradeRow({ trade, compact, onDeleted }: { trade: Trade; compact: boolean; onDeleted?: Props["onDeleted"] }) {
  return <tr className="group border-b border-line/70 transition-colors last:border-0 hover:bg-foreground/[.025]">
    <td className="p-0"><Link href={`/trades/${trade.id}`} className="flex items-center gap-2 px-5 py-4 font-medium text-white"><span>{formatTradeDate(trade.date)}</span><ArrowUpRight size={13} className="text-muted opacity-0 transition-opacity group-hover:opacity-100" /></Link></td>
    <td className="px-3 py-4"><SessionBadge session={trade.session} /></td>
    <td className="px-3 py-4"><DirectionBadge direction={trade.direction} /></td>
    <td className="px-3 py-4 font-medium text-setup">{trade.setup}</td>
    {!compact && <td className="px-3 py-4 font-mono text-muted">{trade.entry.toFixed(2)}</td>}
    <td className="px-3 py-4"><ResultBadge result={trade.result} profitBooked={trade.profitBooked} breakEvenAfterProfit={trade.breakEvenAfterProfit} /></td>
    <td className={trade.actualR > 0 ? "px-3 py-4 text-right font-mono font-medium text-profit" : "px-3 py-4 text-right font-mono font-medium text-loss"}>{formatR(trade.actualR)}</td>
    <td className="px-5 py-2"><Actions id={trade.id} month={trade.date.slice(0, 7)} kind="trade" onDeleted={onDeleted} /></td>
  </tr>;
}

function DraftRow({ draft, compact, onDeleted }: { draft: TradeDraft; compact: boolean; onDeleted?: Props["onDeleted"] }) {
  const entry = draft.data.entry ? Number(draft.data.entry) : NaN;
  return <tr className="border-b border-line/70 bg-gold/[.025] transition-colors last:border-0 hover:bg-gold/[.05]">
    <td className="px-5 py-4 font-medium text-white">{formatTradeDate(draft.date)}</td>
    <td className="px-3 py-4"><SessionBadge session={draft.data.session} /></td>
    <td className="px-3 py-4"><DirectionBadge direction={draft.data.direction} /></td>
    <td className="px-3 py-4 font-medium text-setup">{draft.data.setup || "—"}</td>
    {!compact && <td className="px-3 py-4 font-mono text-muted">{Number.isFinite(entry) ? entry.toFixed(2) : "—"}</td>}
    <td className="px-3 py-4"><span className="rounded border border-gold/30 bg-gold/10 px-2 py-1 text-xs font-semibold text-gold">Draft</span></td>
    <td className="px-3 py-4 text-right text-muted">—</td>
    <td className="px-5 py-2"><Actions id={draft.id} month={draft.date.slice(0, 7)} kind="draft" onDeleted={onDeleted} /></td>
  </tr>;
}
