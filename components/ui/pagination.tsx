"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type PaginationProps = {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  itemLabel?: string;
};

function pageItems(currentPage: number, totalPages: number): Array<number | "ellipsis-start" | "ellipsis-end"> {
  if (totalPages <= 5) return Array.from({ length: totalPages }, (_, index) => index + 1);
  const items: Array<number | "ellipsis-start" | "ellipsis-end"> = [1];
  if (currentPage > 3) items.push("ellipsis-start");
  for (let page = Math.max(2, currentPage - 1); page <= Math.min(totalPages - 1, currentPage + 1); page += 1) items.push(page);
  if (currentPage < totalPages - 2) items.push("ellipsis-end");
  items.push(totalPages);
  return items;
}

export function Pagination({ currentPage, totalItems, pageSize, onPageChange, itemLabel = "items" }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const page = Math.min(Math.max(1, currentPage), totalPages);
  const start = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(totalItems, page * pageSize);

  return <nav aria-label={`${itemLabel} pagination`} className="flex flex-col gap-3 border-t border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
    <p className="text-xs text-muted">Showing <span className="font-medium text-foreground">{start}–{end}</span> of <span className="font-medium text-foreground">{totalItems}</span> {itemLabel}</p>
    <div className="flex flex-wrap items-center gap-1">
      <PageButton label="Previous page" disabled={page === 1} onClick={() => onPageChange(page - 1)}><ChevronLeft size={15} /></PageButton>
      {pageItems(page, totalPages).map(item => typeof item === "number"
        ? <PageButton key={item} label={`Page ${item}`} active={item === page} onClick={() => onPageChange(item)}>{item}</PageButton>
        : <span key={item} className="grid size-8 place-items-center text-xs text-muted" aria-hidden="true">…</span>)}
      <PageButton label="Next page" disabled={page === totalPages} onClick={() => onPageChange(page + 1)}><ChevronRight size={15} /></PageButton>
    </div>
  </nav>;
}

function PageButton({ children, label, active = false, disabled = false, onClick }: { children: React.ReactNode; label: string; active?: boolean; disabled?: boolean; onClick: () => void }) {
  return <button type="button" aria-label={label} aria-current={active ? "page" : undefined} disabled={disabled} onClick={onClick} className={cn("focus-ring grid size-8 place-items-center rounded-md border text-xs font-medium transition-colors",active?"border-accent/40 bg-accent/10 text-accent":"border-line bg-surface-raised text-muted hover:border-accent/30 hover:text-foreground","disabled:cursor-not-allowed disabled:opacity-40")}>{children}</button>;
}
