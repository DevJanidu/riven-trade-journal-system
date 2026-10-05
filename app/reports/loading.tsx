import { Spinner } from "@/components/ui/spinner";

export default function ReportsLoading() {
  return <div className="space-y-5"><div className="flex items-center gap-2 text-sm text-muted"><Spinner label="Loading report" />Loading report…</div><div className="animate-pulse space-y-5"><div className="h-24 rounded-[10px] bg-surface" /><div className="h-20 rounded-[10px] border border-line bg-surface" /><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-36 rounded-[12px] bg-surface" />)}</div><div className="h-80 rounded-[10px] border border-line bg-surface" /></div></div>;
}
