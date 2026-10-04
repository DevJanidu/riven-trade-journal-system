import { Spinner } from "@/components/ui/spinner";

export default function Loading() {
  return <div className="mx-auto max-w-[1500px] space-y-5"><div className="flex items-center gap-2 text-sm text-muted"><Spinner label="Loading dashboard" />Loading dashboard data…</div><div className="animate-pulse space-y-5"><div className="h-20 rounded-[9px] bg-surface" /><div className="h-28 rounded-[9px] border border-line bg-surface" /><div className="grid gap-5 xl:grid-cols-3"><div className="h-80 rounded-[9px] border border-line bg-surface xl:col-span-2" /><div className="h-80 rounded-[9px] border border-line bg-surface" /></div><div className="h-56 rounded-[9px] border border-line bg-surface" /></div></div>;
}
