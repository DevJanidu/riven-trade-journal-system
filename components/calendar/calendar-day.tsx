import Link from "next/link";
import type { CalendarDay as Day } from "@/types/calendar";
import { calendarDate, dayTone } from "@/lib/trading/calendar";
import { cn, formatR, formatTradeDate } from "@/lib/utils";

export function CalendarDay({ date, day, today, mobile = false }: { date: string; day?: Day; today: string; mobile?: boolean }) {
  const isToday = date === today;
  const weekend = [0, 6].includes(calendarDate(date).getUTCDay());
  const number = <time dateTime={date} aria-current={isToday ? "date" : undefined} className={cn("inline-flex items-center gap-1.5 font-medium tabular-nums", mobile ? "text-sm" : "text-xs", !day && weekend ? "text-muted/60" : "text-foreground")}>
    {mobile ? `${formatTradeDate(date)} — ${new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" }).format(calendarDate(date)).toUpperCase()}` : date.slice(-2)}
    {isToday && <span className="size-1.5 rounded-full bg-accent" title="Today" />}
  </time>;
  if (!day) return <div className={cn("min-h-0 border-b border-r border-line p-1.5 [@media(max-height:700px)]:p-1", weekend && "bg-foreground/[.01]")}>{number}</div>;
  const tone = dayTone(day.netR);
  const rClass = tone === "profit" ? "bg-profit/8 text-profit" : tone === "loss" ? "bg-loss/8 text-loss" : "bg-foreground/[.04] text-muted";
  const outcomes = [day.wins ? `${day.wins}W` : "", day.losses ? `${day.losses}L` : "", day.breakEvens ? `${day.breakEvens}BE` : ""].filter(Boolean).join(" · ");
  return <Link href={`/trades?date=${date}`} prefetch={false}
    aria-label={`${formatTradeDate(date, "long")}, ${day.tradeCount} trades, ${day.wins} wins, ${day.losses} losses, ${day.breakEvens} break even, ${day.netR > 0 ? "positive" : day.netR < 0 ? "negative" : "zero"} ${Math.abs(day.netR)} R. View trades.`}
    className={cn("focus-ring group block transition-colors hover:bg-foreground/[.035]", mobile ? "rounded-lg border border-line bg-surface p-4 hover:border-accent/30" : "min-h-0 border-b border-r border-line p-1.5 [@media(max-height:700px)]:p-1")}>
    {!mobile ? <>
      <div className="flex items-center justify-between gap-1">{number}<p className={cn("rounded px-1 font-mono text-base font-semibold leading-6 tabular-nums [@media(max-height:700px)]:text-sm [@media(max-height:700px)]:leading-5", rClass)}>{formatR(day.netR)}</p></div>
      <p className="whitespace-nowrap text-[11px] leading-4 text-foreground/80 [@media(max-height:700px)]:text-[10px] [@media(max-height:700px)]:leading-3">{outcomes.replaceAll(" · ", "·")}</p>
      <p className="text-[10px] leading-3 text-muted">{day.tradeCount} {day.tradeCount === 1 ? "Trade" : "Trades"}</p>
    </> : <>
    <div className="flex items-center justify-between">{number}<span className={cn("size-1 rounded-full", tone === "profit" ? "bg-profit/70" : tone === "loss" ? "bg-loss/70" : "bg-muted/60")} /></div>
    <div className={cn("mt-3", mobile && "flex items-center justify-between gap-3")}>
      <p className={cn("w-fit rounded px-2 py-1 font-mono text-lg font-semibold tabular-nums lg:text-xl", rClass)}>{formatR(day.netR)}</p>
      <div className={mobile ? "text-right" : "mt-2"}>
        <p className="text-xs text-foreground/80">{outcomes}</p>
        <p className="mt-1 text-[11px] text-muted">{day.tradeCount} {day.tradeCount === 1 ? "Trade" : "Trades"}</p>
      </div>
    </div>
    </>}
  </Link>;
}
