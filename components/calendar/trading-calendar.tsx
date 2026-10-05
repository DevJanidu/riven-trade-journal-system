"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { CalendarData } from "@/types/calendar";
import { calendarCells, shiftMonth } from "@/lib/trading/calendar";
import { monthKey, monthLabel } from "@/lib/utils";
import { Button, ButtonLink } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { CalendarDay } from "./calendar-day";
import { MonthlySummary } from "./monthly-summary";

const weekdays = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

export function TradingCalendar({ data }: { data: CalendarData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [today, setToday] = useState("");
  useEffect(() => {
    function refresh() {
      const now = new Date();
      setToday(`${monthKey(now)}-${String(now.getDate()).padStart(2, "0")}`);
      router.refresh();
    }
    function visible() { if (document.visibilityState === "visible") refresh(); }
    function restored(event: PageTransitionEvent) { if (event.persisted) refresh(); }
    // Refresh on entry, including browser back, so mutations cannot leave stale days.
    refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", restored);
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", restored);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [router]);
  const days = new Map(data.days.map(day => [day.date, day]));
  const cells = calendarCells(data.month);
  function navigate(month: string) {
    startTransition(() => router.push(`/calendar?month=${month}`, { scroll: false }));
  }
  return <section aria-label={monthLabel(data.month)} aria-busy={pending} className="md:flex md:min-h-0 md:flex-1 md:flex-col">
    <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-3 md:mb-2">
      <div className="flex items-center gap-1 rounded-lg border border-line bg-surface p-1">
        <button type="button" disabled={pending} onClick={() => navigate(shiftMonth(data.month, -1))} aria-label="Previous month" className="focus-ring grid size-8 place-items-center rounded text-muted hover:bg-foreground/[.04] hover:text-foreground disabled:opacity-50"><ChevronLeft size={17} /></button>
        <h2 aria-live="polite" className="min-w-36 text-center text-sm font-semibold">{monthLabel(data.month)}</h2>
        <button type="button" disabled={pending} onClick={() => navigate(shiftMonth(data.month, 1))} aria-label="Next month" className="focus-ring grid size-8 place-items-center rounded text-muted hover:bg-foreground/[.04] hover:text-foreground disabled:opacity-50"><ChevronRight size={17} /></button>
      </div>
      <div className="flex items-center gap-3">{pending && <Spinner label="Loading month" />}<Button type="button" className="!h-9" disabled={pending} onClick={() => navigate(monthKey(new Date()))}>Today</Button></div>
    </div>
    <MonthlySummary summary={data.summary} />
    <div className="hidden min-h-0 overflow-hidden rounded-lg border-l border-t border-line bg-surface md:flex md:flex-1 md:flex-col">
      <div className="grid shrink-0 grid-cols-7">{weekdays.map(day => <div key={day} className="border-b border-r border-line px-2 py-1.5 text-center text-[10px] font-medium tracking-widest text-muted">{day}</div>)}</div>
      <div className="grid min-h-0 flex-1 grid-cols-7" style={{ gridTemplateRows: `repeat(${cells.length / 7}, minmax(0, 1fr))` }}>{cells.map((date, index) => date
        ? <CalendarDay key={date} date={date} day={days.get(date)} today={today} />
        : <div key={`empty-${index}`} aria-hidden="true" className="min-h-0 border-b border-r border-line bg-background/30" />)}</div>
    </div>
    <div className="space-y-3 md:hidden" aria-label="Traded days">{data.days.map(day => <CalendarDay key={day.date} date={day.date} day={day} today={today} mobile />)}</div>
    {!data.days.length && <div className="mt-3 shrink-0 rounded-lg border border-dashed border-line bg-surface p-4 text-center md:mt-2 md:flex md:items-center md:justify-between md:px-3 md:py-2 md:text-left">
      <div><p className="text-sm font-medium">No trades this month</p><p className="mb-3 mt-1 text-xs text-muted md:mb-0 md:mt-0">Your completed trades will appear here.</p></div><ButtonLink href="/journal" className="md:!h-8 md:text-xs">Journal Trade</ButtonLink>
    </div>}
    <p className="mt-3 shrink-0 text-xs text-muted md:mt-1.5 md:text-[11px]">Net R determines each day’s performance. Select a traded day to review its trades.</p>
  </section>;
}
