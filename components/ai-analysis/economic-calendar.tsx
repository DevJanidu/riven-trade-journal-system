import type { EconomicCalendarSnapshot } from "@/lib/market-data/types";

export function FinanceCalendarAttribution() {
  return <p className="mt-4 text-xs leading-6 text-muted">Economic calendar data provided by <a href="https://www.financecalendar.com/" target="_blank" rel="noopener noreferrer" className="focus-ring text-accent hover:underline">FinanceCalendar</a>.</p>;
}
export function EconomicCalendarSection({ calendar }: { calendar: EconomicCalendarSnapshot | null | undefined }) {
  return <section className="rounded-[10px] border border-line bg-surface p-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-[11px] font-semibold uppercase tracking-[.14em] text-muted">High-impact events · Economic calendar</h2>
      <span className="rounded border border-line px-3 py-1 text-xs font-medium uppercase text-accent">Weekly event risk: {calendar?.eventRisk.replaceAll("_", " ") ?? "Unavailable"}</span>
    </div>
    <p className="mt-3 text-xs leading-6 text-muted">Event risk measures scheduled uncertainty and potential volatility, not Gold direction. Relevant medium-impact events are also included.</p>
    {!calendar ? <p className="mt-4 text-sm text-secondary">Economic calendar unavailable in this saved snapshot. Generate a new analysis to collect current provider data.</p> : <>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">{calendar.dailyRisk.map(day => <div key={day.date} className="rounded border border-line px-3 py-3"><p className="text-xs text-muted">{new Date(`${day.date}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" })}</p><p className="mt-2 text-xs font-semibold uppercase text-accent">{day.risk.replaceAll("_", " ")}</p></div>)}</div>
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{calendar.dailyRisk.map(day => {
        const events = calendar.events.filter(event => event.date === day.date);
        return <div key={day.date} className="min-w-0 rounded border border-line p-4"><h3 className="text-xs font-semibold text-foreground">{new Date(`${day.date}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" })}</h3>
          {!events.length ? <p className="mt-3 text-xs leading-6 text-muted">No relevant high- or medium-impact events returned by the provider.</p> : <div className="mt-3 space-y-4">{events.map((event, index) => {
            const et = event.timeUtc ? new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(event.timeUtc)) : event.timeEt;
            return <article key={`${event.title}:${index}`} className="space-y-2 break-words border-t border-line pt-3 text-xs leading-5">
              <p className="font-medium text-secondary">{event.title}</p><p className="text-muted">{event.allDay ? "All day" : et ? `${et} ET` : "Time unavailable"} · Impact: <span className="uppercase">{event.impact}</span>{event.relevance === "major_central_bank" ? " · Non-US policy context" : ""}</p>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1"><dt className="text-muted">Prior</dt><dd className="text-secondary">{event.prior ?? "—"}</dd><dt className="text-muted">Consensus</dt><dd className="text-secondary">{event.consensus ?? "Unavailable"}</dd><dt className="text-muted">Actual</dt><dd className="text-secondary">{event.actual ?? "Not supplied"}</dd></dl>
              {event.surprise && <p className="text-secondary">Surprise: {event.surprise.value > 0 ? "+" : ""}{event.surprise.value.toLocaleString("en-US")} {event.surprise.units.replaceAll("_", " ")}</p>}
              {event.timeUtc && <p className="text-muted">UTC: {event.timeUtc}</p>}
              {event.sourceUrl && <a href={event.sourceUrl} target="_blank" rel="noopener noreferrer" className="focus-ring inline-block text-accent hover:underline">View event details</a>}
            </article>;
          })}</div>}
        </div>;
      })}</div>
      <p className="mt-4 text-xs leading-6 text-muted">Consensus: {calendar.consensusCoverage.available}/{calendar.consensusCoverage.eligible} upcoming priority US events ({calendar.consensusCoverage.percent === null ? "no eligible events" : `${calendar.consensusCoverage.percent}% coverage`}); high-impact: {calendar.consensusCoverage.highImpactAvailable}/{calendar.consensusCoverage.highImpactEligible}. Missing estimates remain unavailable.</p>
      <p className="mt-2 text-xs leading-6 text-muted">Fetched {calendar.fetchedAt}. Saved report data does not update automatically. Actuals may arrive roughly an hour after release; this is not a real-time release feed.</p>
      <FinanceCalendarAttribution />
    </>}
  </section>;
}
