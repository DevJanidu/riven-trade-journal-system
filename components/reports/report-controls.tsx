"use client";

import { Download } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import type { ReportPeriod } from "@/lib/reports";
import { cn } from "@/lib/utils";

const periods: Array<{ value: ReportPeriod; label: string }> = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

export function ReportControls({ period, date, hasTrades }: { period: ReportPeriod; date: string; hasTrades: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  function update(nextPeriod: ReportPeriod, nextDate = date) {
    router.push(`${pathname}?period=${nextPeriod}&date=${nextDate}`);
  }
  const downloadUrl = `/api/reports/export?period=${period}&date=${date}`;

  return <div className="flex flex-col gap-3 rounded-[10px] border border-line bg-surface p-4 sm:flex-row sm:items-end sm:justify-between">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div><p className="mb-2 text-[10px] font-semibold uppercase tracking-[.14em] text-muted">Report period</p><div role="group" aria-label="Report period" className="inline-flex rounded-md border border-line bg-background-secondary p-1">{periods.map(item => <button key={item.value} type="button" aria-pressed={period === item.value} onClick={() => update(item.value)} className={cn("focus-ring rounded px-3 py-2 text-xs font-semibold text-muted hover:text-foreground", period === item.value && "bg-surface-elevated text-accent")}>{item.label}</button>)}</div></div>
      <label className="block"><span className="mb-2 block text-[10px] font-semibold uppercase tracking-[.14em] text-muted">Date in period</span><input className="form-input w-full sm:w-44" type="date" value={date} onChange={event => update(period, event.target.value)} /></label>
    </div>
    {hasTrades ? <a href={downloadUrl} className="focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-md border border-primary bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary-hover"><Download size={16} />Download Excel</a> : <button type="button" disabled className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-line bg-surface-raised px-4 text-sm font-semibold text-muted opacity-50"><Download size={16} />Download Excel</button>}
  </div>;
}
