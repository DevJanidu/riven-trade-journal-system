import { Spinner } from "@/components/ui/spinner";

export default function Loading() {
  return <div role="status" className="flex min-h-96 items-center justify-center gap-3 text-sm text-muted"><Spinner label="Loading calendar" />Loading calendar…</div>;
}
