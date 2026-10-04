import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TradeForm } from "@/components/journal/trade-form";
import { PageHeader } from "@/components/ui/page-header";
import { getTradeById } from "@/lib/data/trades";
import { tradeIdSchema } from "@/lib/validations/trade";

export const metadata: Metadata = { title: "Edit Trade" };
export default async function EditTradePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!tradeIdSchema.safeParse(id).success) notFound();
  const trade = await getTradeById(id);
  if (!trade) notFound();
  return <><PageHeader eyebrow="XAUUSD · Gold" title="Edit Trade" description="Update the execution details, notes, or review for this trade." /><TradeForm initialTrade={trade} /></>;
}
