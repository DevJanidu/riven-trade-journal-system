import type { Metadata } from "next";
import { TradesView } from "@/components/trades/trades-view";
import { getMonthlyTrades, getTrades } from "@/lib/data/trades";
import { getDrafts } from "@/lib/data/drafts";
import { tradeQuerySchema, monthSchema, tradeDateSchema } from "@/lib/validations/trade";
import { monthKey } from "@/lib/utils";
import type { TradeFilters } from "@/types/trade";

export const metadata: Metadata = { title: "Trades" };

export default async function TradesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const parsedDate = tradeDateSchema.safeParse(params.date);
  const date = parsedDate.success ? parsedDate.data : undefined;
  const month = date?.slice(0, 7) ?? (monthSchema.safeParse(params.month).success ? params.month as string : monthKey(new Date()));
  const parsed = tradeQuerySchema.safeParse(params);
  const filters: TradeFilters = parsed.success ? { ...parsed.data, month, date } : { month, date };
  const [monthly, drafts] = await Promise.all([date ? getTrades({ date }) : getMonthlyTrades(month), date ? Promise.resolve([]) : getDrafts(month)]);
  const hasFilters = Boolean(filters.session || filters.setup || filters.result || filters.direction);
  const visible = hasFilters ? await getTrades(filters) : monthly;
  return <TradesView key={JSON.stringify(filters)} month={month} initialFilters={filters} summaryTrades={monthly} initialTrades={visible} initialDrafts={drafts} />;
}
