import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { TradeForm } from "@/components/journal/trade-form";
import { getDraftById } from "@/lib/data/drafts";
import { z } from "zod";

export const metadata: Metadata = { title: "Journal Trade" };
export default async function JournalPage({ searchParams }: { searchParams: Promise<{ edit?: string; draft?: string }> }) {
  const { edit, draft: draftId } = await searchParams;
  if (edit) redirect(`/trades/${encodeURIComponent(edit)}/edit`);
  if (draftId && !z.uuid().safeParse(draftId).success) notFound();
  const draft = draftId ? await getDraftById(draftId) : undefined;
  if (draftId && !draft) notFound();
  return <><PageHeader eyebrow="XAUUSD — Gold" title={draft ? "Complete Draft" : "Journal Trade"} description="Record the plan, execution, and lesson. No noise—only what helps the next decision." /><TradeForm initialDraft={draft ?? undefined} /></>;
}
