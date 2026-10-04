import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type KpiTone = "neutral" | "profit" | "loss";

type KpiCardProps = {
  icon: LucideIcon;
  value: string | number;
  label: string;
  detail: string;
  tone?: KpiTone;
  progress?: number;
};

export function KpiCard({ icon: Icon, value, label, detail, tone = "neutral", progress }: KpiCardProps) {
  const valueClass = tone === "profit" ? "text-profit" : tone === "loss" ? "text-loss" : "text-foreground";
  const iconClass = tone === "profit" ? "border-profit/20 bg-profit/10 text-profit" : tone === "loss" ? "border-loss/20 bg-loss/10 text-loss" : "border-gold/20 bg-gold/10 text-gold";
  const glowClass = tone === "profit" ? "bg-profit/10" : tone === "loss" ? "bg-loss/10" : "bg-gold/10";
  const barClass = tone === "loss" ? "bg-loss" : "bg-profit";

  return <article className="group relative min-h-36 overflow-hidden rounded-[12px] border border-line bg-surface p-5 shadow-[0_8px_28px_rgba(0,0,0,.08)] transition-colors hover:border-foreground/15">
    <span aria-hidden="true" className={cn("pointer-events-none absolute -right-10 -top-12 size-32 rounded-full blur-3xl transition-opacity group-hover:opacity-80", glowClass)} />
    <div className="relative flex items-start justify-between gap-3">
      <div className="min-w-0"><p className="truncate text-[10px] font-semibold uppercase tracking-[.15em] text-muted">{label}</p><p className={cn("mt-3 whitespace-nowrap text-3xl font-semibold tabular-nums tracking-[-.035em]", valueClass)}>{value}</p></div>
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-[10px] border", iconClass)}><Icon size={18} strokeWidth={1.8} /></span>
    </div>
    <div className="relative mt-4 flex items-center gap-3">
      {progress !== undefined && <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-foreground/[.06]" aria-hidden="true"><span className={cn("block h-full rounded-full", barClass)} style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} /></span>}
      <p className={cn("text-xs text-muted", progress === undefined && "w-full")}>{detail}</p>
    </div>
  </article>;
}
