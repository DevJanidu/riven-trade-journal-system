import type { Metadata } from "next";
import { TradingCalendar } from "@/components/calendar/trading-calendar";
import { getCalendarData } from "@/lib/data/calendar";
import { monthSchema } from "@/lib/validations/trade";
import { monthKey } from "@/lib/utils";

export const metadata: Metadata = { title: "Trading Calendar" };
export const dynamic = "force-dynamic";

export default async function CalendarPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const parsed = monthSchema.safeParse(params.month);
  const month = parsed.success ? parsed.data : monthKey(new Date());
  const data = await getCalendarData(month);
  return <div className="md:flex md:h-[calc(100dvh-2rem)] md:min-h-0 md:flex-col">
    <header className="mb-3 shrink-0 md:mb-2">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Trading Calendar</h1>
      <p className="mt-1 text-sm text-muted">Monthly XAUUSD performance</p>
    </header>
    <TradingCalendar data={data} />
  </div>;
}
