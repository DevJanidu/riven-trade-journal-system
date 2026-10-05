import type { CalendarData } from "@/types/calendar";
import { cn, formatR } from "@/lib/utils";

export function MonthlySummary({ summary }: { summary: CalendarData["summary"] }) {
  const metrics = [
    ["Trading days", summary.tradingDays], ["Trades", summary.totalTrades],
    ["Wins", summary.wins], ["Losses", summary.losses], ["Break even", summary.breakEvens],
    ["Win rate", `${summary.winRate.toFixed(1)}%`], ["Net R", formatR(summary.netR)],
  ] as const;
  return <dl aria-label="Monthly performance summary" className="mb-3 grid shrink-0 grid-cols-3 gap-x-4 gap-y-4 rounded-lg border border-line bg-surface px-5 py-4 sm:grid-cols-4 md:mb-2 md:grid-cols-7 md:gap-x-2 md:px-3 md:py-2">
    {metrics.map(([label, value]) => <div key={label}>
      <dt className="text-[11px] text-muted">{label}</dt>
      <dd className={cn("mt-1 font-mono text-base font-semibold tabular-nums md:mt-0 md:text-sm", label === "Net R" && (summary.netR > 0 ? "text-profit" : summary.netR < 0 ? "text-loss" : "text-muted"))}>{value}</dd>
    </div>)}
  </dl>;
}
