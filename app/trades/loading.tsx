import { Spinner } from "@/components/ui/spinner";

export default function Loading() {
  return <div className="space-y-5"><div className="flex items-center gap-2 text-sm text-muted"><Spinner label="Loading trades" />Loading trades…</div><div className="animate-pulse space-y-5"><div className="h-24 bg-surface" /><div className="h-16 border border-line bg-surface" /><div className="h-96 border border-line bg-surface" /></div></div>;
}
