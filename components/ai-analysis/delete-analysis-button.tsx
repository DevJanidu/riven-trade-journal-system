"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DeleteAnalysisButton({ id, week, redirectAfterDelete }: { id: string; week: string; redirectAfterDelete?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);
  async function remove() {
    if (busy.current || !window.confirm(`Delete the analysis for ${week}? This permanently removes the saved report and its data snapshot.`)) return;
    busy.current = true; setPending(true); setError("");
    try {
      const response = await fetch(`/api/ai-analysis/${id}`, { method: "DELETE" });
      const result: { success?: boolean; error?: string } = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Unable to delete analysis.");
      if (redirectAfterDelete) router.replace(redirectAfterDelete);
      router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to delete analysis."); }
    finally { busy.current = false; setPending(false); }
  }
  return <div className="shrink-0">
    <Button type="button" variant="ghost" className="h-9 px-2 text-xs hover:text-loss" disabled={pending} aria-label={`Delete analysis for ${week}`} onClick={() => void remove()}><Trash2 size={14} />{pending ? "Deleting…" : "Delete"}</Button>
    {error && <p role="alert" className="mt-1 max-w-60 text-xs text-loss">{error}</p>}
  </div>;
}
