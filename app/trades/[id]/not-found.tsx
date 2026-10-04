import { ButtonLink } from "@/components/ui/button";

export default function TradeNotFound() {
  return <div className="grid min-h-72 place-items-center border border-line bg-surface p-8 text-center"><div><h1 className="text-lg font-semibold text-white">Trade not found</h1><p className="mt-2 text-sm text-muted">This trade may have been removed, or the link may be incorrect.</p><ButtonLink href="/trades" className="mt-5">Back to Trades</ButtonLink></div></div>;
}
