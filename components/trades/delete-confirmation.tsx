"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ApiResponse } from "@/types/trade";
import { Spinner } from "@/components/ui/spinner";

type Props = {
  tradeId: string;
  month: string;
  kind?: "trade" | "draft";
  compact?: boolean;
  onDeleted?: (id: string) => void;
};

export function DeleteConfirmation({ tradeId, month, kind = "trade", compact = false, onDeleted }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const label = kind === "draft" ? "Draft" : "Trade";

  async function remove() {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/${kind === "draft" ? "drafts" : "trades"}/${tradeId}`, { method: "DELETE" });
      const json: ApiResponse<{ id: string }> = await response.json();
      if (!response.ok || !json.success) throw new Error(json.success ? `Unable to delete ${kind}` : json.error);
      setOpen(false);
      if (onDeleted) onDeleted(tradeId);
      else router.push(`/trades?month=${month}`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `Unable to delete ${kind}`);
    } finally {
      setPending(false);
    }
  }

  return <>
    <Button type="button" variant="danger" className={compact ? "!h-8 gap-1.5 px-2.5 text-xs" : undefined} onClick={() => setOpen(true)}>
      <Trash2 size={compact ? 13 : 15} />{compact ? "Delete" : `Delete ${label}`}
    </Button>
    {open && <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="delete-title">
      <div className="w-full max-w-md border border-line bg-surface-raised shadow-2xl">
        <div className="flex items-start gap-4 p-5">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-loss/10 text-loss"><AlertTriangle size={20} /></span>
          <div><h2 id="delete-title" className="font-semibold text-white">Delete this {kind}?</h2><p className="mt-2 text-sm leading-6 text-muted">This permanently removes the {kind} and its saved journal entry. This action cannot be undone.</p></div>
          <button type="button" onClick={() => setOpen(false)} disabled={pending} className="focus-ring ml-auto text-muted hover:text-white" aria-label="Close"><X size={18} /></button>
        </div>
        {error && <p role="alert" className="px-5 pb-3 text-sm text-loss">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-line p-4">
          <Button type="button" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
          <Button type="button" variant="danger" onClick={remove} disabled={pending}>{pending && <Spinner label={`Deleting ${kind}`} />}{pending ? "Deleting…" : `Delete ${label}`}</Button>
        </div>
      </div>
    </div>}
  </>;
}
