import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { getAnalysisHistory, getAnalysisHistoryCount, getCurrentGoldAnalysis, getGoldAnalysisById } from "@/lib/data/gold-analyses";
import { AnalysisControls } from "@/components/ai-analysis/analysis-controls";
import { AnalysisReport, biasLabel } from "@/components/ai-analysis/analysis-report";
import { DeleteAnalysisButton } from "@/components/ai-analysis/delete-analysis-button";
import { tradingWeek } from "@/lib/market-data/calculations";
import { UrlPagination } from "@/components/ui/url-pagination";
import { paginate, parsePage, TABLE_PAGE_SIZE } from "@/lib/pagination";
export const metadata: Metadata = { title: "AI Analysis" };
export default async function AiAnalysisPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  const params = await searchParams;
  if (params.id !== undefined && !z.string().uuid().safeParse(params.id).success) notFound();
  const requestedPage = parsePage(typeof params.historyPage === "string" && /^\d+$/.test(params.historyPage) ? String(Number(params.historyPage) + 1) : undefined);
  const [latest, historyCount] = await Promise.all([getCurrentGoldAnalysis(user.id), getAnalysisHistoryCount(user.id)]);
  const historyPagination = paginate(historyCount, requestedPage, TABLE_PAGE_SIZE);
  const page = historyPagination.page - 1;
  const history = await getAnalysisHistory(user.id, historyPagination.offset, TABLE_PAGE_SIZE);
  const selected = typeof params.id === "string" ? await getGoldAnalysisById(user.id, params.id) : latest;
  if (params.id && !selected) notFound();
  const week = tradingWeek();
  return <div className="mx-auto max-w-[1500px] space-y-5"><header className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[.17em] text-gold">Gold fundamental outlook</p><h1 className="mt-2 text-2xl font-semibold tracking-tight">{selected ? `${selected.weekStart} – ${selected.weekEnd}` : `${week.start} – ${week.end}`}</h1><p className="mt-2 text-xs text-muted">{selected ? `Last generated: ${selected.createdAt.toLocaleString("en-US", { timeZone: "UTC" })} UTC` : "Professional weekly Gold fundamental research."}</p></div>{selected && latest && selected.id !== latest.id && <Link className="focus-ring rounded text-xs text-accent" href="/ai-analysis">View latest report</Link>}</header>
    <AnalysisControls hasAnalysis={!!latest} />
    {selected ? <AnalysisReport report={selected} /> : <section className="grid min-h-52 place-items-center rounded-[10px] border border-dashed border-line bg-surface p-6 text-center"><div><h2 className="font-semibold">No saved weekly analysis yet</h2><p className="mt-3 max-w-md text-sm leading-6 text-muted">Generate your first Gold macro outlook to review evidence, conditional scenarios, and the gaps in available data.</p></div></section>}
    <section className="rounded-[10px] border border-line bg-surface p-5"><h2 className="text-[11px] font-semibold uppercase tracking-[.14em] text-muted">Previous analyses</h2><div className="mt-4 divide-y divide-line">{history.map(item => <div key={item.id} className="flex items-center gap-3"><Link href={`/ai-analysis?id=${item.id}&historyPage=${page}`} className="focus-ring flex min-w-0 flex-1 flex-wrap items-center justify-between gap-2 rounded py-3 text-sm hover:text-accent"><span>{item.weekStart} – {item.weekEnd}<span className="ml-3 text-xs capitalize text-muted">{biasLabel(item.fundamentalBias)}</span></span><span className="text-xs text-muted">{item.confidence}/100 · {item.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC</span></Link><DeleteAnalysisButton id={item.id} week={`${item.weekStart} – ${item.weekEnd}`} redirectAfterDelete={selected?.id === item.id || history.length === 1 ? `/ai-analysis?historyPage=${history.length === 1 ? Math.max(0, page - 1) : page}` : undefined} /></div>)}{!history.length && <p className="text-sm text-muted">No reports saved.</p>}</div><UrlPagination currentPage={historyPagination.page} totalItems={historyCount} pageSize={TABLE_PAGE_SIZE} pageParameter="historyPage" itemLabel="analyses" zeroBased /></section>
  </div>;
}
