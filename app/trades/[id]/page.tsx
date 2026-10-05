import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Pencil } from "lucide-react";
import { DeleteConfirmation } from "@/components/trades/delete-confirmation";
import { TradeScreenshotViewer } from "@/components/trades/trade-screenshot-viewer";
import { ButtonLink } from "@/components/ui/button";
import { DirectionBadge, ResultBadge, SessionBadge } from "@/components/ui/badges";
import { getTradeById } from "@/lib/data/trades";
import { tradeIdSchema } from "@/lib/validations/trade";
import { formatR, formatRR } from "@/lib/utils";
import type { Trade } from "@/types/trade";

export const metadata: Metadata = { title: "Trade Review" };

export default async function TradePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!tradeIdSchema.safeParse(id).success) notFound();
  const trade = await getTradeById(id);
  if (!trade) notFound();
  const date = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", year: "numeric", month: "long", day: "numeric" }).format(new Date(`${trade.date}T12:00:00Z`));
  return <div className="mx-auto max-w-[1200px] space-y-5">
    <Link href={`/trades?date=${trade.date}`} className="focus-ring inline-flex items-center gap-2 rounded text-sm text-muted hover:text-white"><ArrowLeft size={15} />Back to Trades</Link>
    <header className="flex flex-wrap items-end justify-between gap-5 border-b border-line pb-5">
      <div><p className="text-xs font-semibold uppercase tracking-[.16em] text-gold">XAUUSD · Gold</p><div className="mt-1 flex items-center gap-3"><h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">XAUUSD</h1><DirectionBadge direction={trade.direction} /></div><div className="mt-2 flex items-center gap-2 text-sm text-muted"><span>{date}</span><span>·</span><SessionBadge session={trade.session} /></div></div>
      <div className="flex items-center gap-4"><ResultBadge result={trade.result} /><div className="text-right"><p className={`text-2xl font-semibold tabular-nums ${trade.actualR < 0 ? "text-loss" : "text-profit"}`}>{formatR(trade.actualR)}</p><p className="text-sm tabular-nums text-muted">{trade.profitLoss >= 0 ? "+" : "−"}${Math.abs(trade.profitLoss).toFixed(2)}</p></div></div>
    </header>
    <section className="rounded-[9px] border border-line bg-surface p-5"><h2 className="mb-4 text-sm font-semibold text-white">Trade Information</h2><div className="grid grid-cols-2 gap-x-5 gap-y-4 sm:grid-cols-3 lg:grid-cols-6"><Fact label="Entry" value={trade.entry.toFixed(2)} /><Fact label="Stop Loss" value={trade.stopLoss.toFixed(2)} /><Fact label="Take Profit" value={trade.takeProfit.toFixed(2)} /><Fact label="Risk" value={`$${trade.riskAmount.toFixed(2)}`} /><Fact label="Planned R:R" value={formatRR(trade.plannedRR)} /><Fact label="Actual Result" value={formatR(trade.actualR)} /></div></section>
    <section className="grid gap-5 md:grid-cols-2"><div className="rounded-[9px] border border-line bg-surface p-5"><h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Setup</h2><p className="mt-2 text-lg font-medium text-setup">{trade.setup} {trade.setupGrade && <span className="ml-2 text-accent">{trade.setupGrade}</span>}</p>{trade.setupChecklist && trade.setupChecklist.length > 0 && <ul className="mt-3 space-y-1 text-sm text-muted">{trade.setupChecklist.map(rule => <li key={rule}>✓ {rule}</li>)}</ul>}{trade.tradingViewUrl && <a className="mt-3 inline-flex items-center gap-1.5 text-xs text-accent hover:text-white" href={trade.tradingViewUrl} target="_blank" rel="noopener noreferrer">Open TradingView chart <ExternalLink size={13} /></a>}</div><div className="rounded-[9px] border border-line bg-surface p-5"><h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Psychology</h2><p className="mt-2 text-sm text-white">Emotion: <span className="font-medium">{trade.emotion}</span></p><p className="mt-1 text-sm text-white">Followed Rules: <span className="font-medium">{trade.followedRules ? "Yes" : "No"}</span></p><p className="mt-1 text-sm text-white">Ready to risk the amount: <span className="font-medium">{trade.psychologyReady ? "Yes" : "No"}</span></p>{trade.psychologyAnswer && <p className="mt-3 text-sm leading-6 text-muted">{trade.psychologyAnswer}</p>}</div></section>
    <section className="grid gap-5 lg:grid-cols-2"><Screenshot title="BEFORE TRADE" src={trade.beforeScreenshot} /><Screenshot title="AFTER TRADE" src={trade.afterScreenshot} /></section>
    <section className="rounded-[9px] border border-line bg-surface p-5"><h2 className="text-sm font-semibold text-white">Why did I enter this trade?</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#c7d0d8]">{trade.entryReason || "No entry thesis recorded."}</p></section>
    <section className="grid gap-5 lg:grid-cols-3"><Note title="What Went Well" text={trade.wentWell} /><Note title="What Went Wrong" text={trade.wentWrong} /><Note title="What Could Be Improved" text={trade.improvement} /></section>
    <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-5"><ButtonLink href={`/trades/${trade.id}/edit`}><Pencil size={15} />Edit Trade</ButtonLink><DeleteConfirmation tradeId={trade.id} month={trade.date.slice(0, 7)} /></div>
  </div>;
}

function Fact({ label, value }: { label: string; value: string }) { return <div><p className="text-xs text-muted">{label}</p><p className="mt-1 font-semibold tabular-nums text-white">{value}</p></div>; }
function Note({ title, text }: { title: string; text: string }) { return <section className="rounded-[9px] border border-line bg-surface p-5"><h2 className="text-sm font-semibold text-white">{title}</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#c7d0d8]">{text || "No note recorded."}</p></section>; }
function Screenshot({ title, src }: { title: string; src?: Trade["beforeScreenshot"] }) { return <section className="rounded-[9px] border border-line bg-surface p-4"><h2 className="mb-3 text-xs font-semibold tracking-[.13em] text-muted">{title}</h2>{src ? <TradeScreenshotViewer src={src} label={title.toLowerCase()} /> : <div className="grid aspect-video place-items-center border border-dashed border-line bg-[#090f15] text-sm text-muted">No screenshot added</div>}</section>; }
