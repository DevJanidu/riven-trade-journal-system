"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export function AnalysisControls({ hasAnalysis }: { hasAnalysis: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);
  const busy = useRef(false);
  async function generate() {
    if (busy.current) return;
    busy.current = true; setPending(true); setError(""); setConfirm(false);
    try {
      const response = await fetch("/api/ai-analysis/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(typeof result.error === "string" ? result.error : "Unable to generate analysis.");
      router.push(`/ai-analysis?id=${result.data.id}`); router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to generate analysis."); }
    finally { busy.current = false; setPending(false); }
  }
  return <section className="rounded-[10px] border border-line bg-surface p-4 sm:p-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold text-foreground">Weekly fundamental research</p><p className="mt-1 text-xs leading-5 text-muted">Generate intentionally. Saved reports load without using AI credit. A 15-minute cooldown applies to generation attempts.</p></div><Button variant="primary" disabled={pending} onClick={() => hasAnalysis ? setConfirm(true) : void generate()}>{pending ? <Spinner label="Generating" /> : <RefreshCw size={15} />}{pending ? "Generating analysis…" : hasAnalysis ? "Refresh Analysis" : "Generate Weekly Analysis"}</Button></div>
    {pending && <p role="status" className="mt-4 flex items-center gap-2 text-sm text-accent"><Spinner label="Generating fundamental analysis" />Generating fundamental analysis. This may take a minute.</p>}
    {error && <p role="alert" className="mt-4 rounded-md border border-loss/20 bg-loss/5 p-3 text-sm text-loss">{error}</p>}
    {confirm && <div role="dialog" aria-modal="true" aria-labelledby="analysis-confirm-title" className="fixed inset-0 z-50 grid place-items-center bg-overlay p-4"><section className="w-full max-w-md rounded-[12px] border border-line bg-surface-elevated p-5"><h2 id="analysis-confirm-title" className="font-semibold">Generate a new analysis?</h2><p className="mt-3 text-sm leading-6 text-secondary">This uses OpenAI credit and saves a new report for the current week. Existing reports stay in your history. The server enforces the 15-minute cooldown.</p><div className="mt-5 flex justify-end gap-2"><Button autoFocus onClick={() => setConfirm(false)}>Cancel</Button><Button variant="primary" onClick={() => void generate()}>Generate new report</Button></div></section></div>}
  </section>;
}
