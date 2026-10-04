import { Spinner } from "@/components/ui/spinner";

export default function Loading() {
  return <div className="mx-auto max-w-[1500px] space-y-5"><div className="flex items-center gap-2 text-sm text-muted"><Spinner label="Loading trade" />Loading trade…</div><div className="animate-pulse space-y-5"><div className="h-24 rounded-[9px] bg-surface" /><div className="grid gap-5 lg:grid-cols-2"><div className="aspect-video border border-line bg-surface" /><div className="aspect-video border border-line bg-surface" /></div><div className="h-56 border border-line bg-surface" /></div></div>;
}
