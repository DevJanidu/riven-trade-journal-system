"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { monthLabel } from "@/lib/utils";

const weekdays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function usePickerDismiss(open: boolean, close: () => void) {
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) close();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        close();
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  return { containerRef, triggerRef };
}

function PickerHeader({ title, previous, next, previousLabel, nextLabel }: {
  title: string; previous: () => void; next: () => void; previousLabel: string; nextLabel: string;
}) {
  return <div className="mb-3 flex items-center justify-between gap-2">
    <p className="text-sm font-semibold text-white">{title}</p>
    <div className="flex items-center gap-1">
      <button type="button" onClick={previous} aria-label={previousLabel} className="focus-ring grid size-8 place-items-center rounded-md text-muted hover:bg-[#22313e] hover:text-white"><ChevronLeft size={16} /></button>
      <button type="button" onClick={next} aria-label={nextLabel} className="focus-ring grid size-8 place-items-center rounded-md text-muted hover:bg-[#22313e] hover:text-white"><ChevronRight size={16} /></button>
    </div>
  </div>;
}

const popoverClass = "absolute left-0 top-[calc(100%+8px)] z-50 w-[296px] max-w-[calc(100vw-2rem)] rounded-[10px] border border-[#314253] bg-[#111922] p-3 shadow-[0_18px_40px_rgba(0,0,0,.32)]";

export function DatePicker({ name, label, initialValue }: { name: string; label: string; initialValue: string }) {
  const [value, setValue] = useState(initialValue);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => {
    const date = parseDate(initialValue);
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });
  const { containerRef, triggerRef } = usePickerDismiss(open, () => setOpen(false));
  const selectedDate = parseDate(value);
  const firstWeekday = new Date(view.getFullYear(), view.getMonth(), 1).getDay();
  const cells = Array.from({ length: 42 }, (_, index) => new Date(view.getFullYear(), view.getMonth(), index - firstWeekday + 1));
  const labelText = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(selectedDate);
  const today = dateKey(new Date());

  function selectDay(date: Date) {
    setValue(dateKey(date));
    setView(new Date(date.getFullYear(), date.getMonth(), 1));
    setOpen(false);
    triggerRef.current?.focus();
  }

  return <div ref={containerRef} className="relative min-w-0">
    <span className="mb-2 block text-sm font-medium text-[#cbd3d8]">{label}</span>
    <input type="hidden" name={name} value={value} />
    <button ref={triggerRef} type="button" aria-label={`Choose ${label.toLowerCase()}`} aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(current => !current)} className="form-input focus-ring flex items-center justify-between gap-3 text-left">
      <span className="truncate tabular-nums">{labelText}</span><CalendarDays size={16} className="shrink-0 text-muted" />
    </button>
    {open && <div role="dialog" aria-label={`${label} calendar`} className={popoverClass}>
      <PickerHeader title={monthLabel(`${view.getFullYear()}-${String(view.getMonth() + 1).padStart(2, "0")}`)} previous={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))} next={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))} previousLabel="Previous month" nextLabel="Next month" />
      <div className="grid grid-cols-7 gap-1">{weekdays.map(day => <span key={day} className="grid h-7 place-items-center text-[10px] font-semibold uppercase tracking-wider text-muted">{day}</span>)}
        {cells.map(date => { const key = dateKey(date); const selected = key === value; const inMonth = date.getMonth() === view.getMonth(); return <button type="button" key={key} onClick={() => selectDay(date)} aria-label={new Intl.DateTimeFormat("en-US", { dateStyle: "full" }).format(date)} aria-pressed={selected} className={`focus-ring grid h-8 place-items-center rounded-md text-xs tabular-nums transition-colors ${selected ? "bg-accent font-semibold text-[#09211f]" : inMonth ? "text-[#d5dce3] hover:bg-[#22313e]" : "text-[#657485] hover:bg-[#22313e]"} ${key === today && !selected ? "ring-1 ring-inset ring-gold/60" : ""}`}>{date.getDate()}</button>; })}
      </div>
      <div className="mt-2 flex justify-between border-t border-line pt-2"><button type="button" onClick={() => setView(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1))} className="focus-ring rounded px-2 py-1.5 text-xs text-muted hover:text-white">Selected date</button><button type="button" onClick={() => selectDay(new Date())} className="focus-ring rounded px-2 py-1.5 text-xs font-medium text-accent hover:bg-accent/10">Today</button></div>
    </div>}
  </div>;
}

export function MonthPicker({ value, onChange, label = "Month" }: { value: string; onChange: (month: string) => void; label?: string }) {
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() => Number(value.slice(0, 4)));
  const { containerRef, triggerRef } = usePickerDismiss(open, () => setOpen(false));
  const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

  function selectMonth(month: number) {
    onChange(`${viewYear}-${String(month + 1).padStart(2, "0")}`);
    setOpen(false);
    triggerRef.current?.focus();
  }

  return <div ref={containerRef} className="relative min-w-0">
    <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-muted">{label}</span>
    <button ref={triggerRef} type="button" aria-label="Choose trading month" aria-expanded={open} aria-haspopup="dialog" onClick={() => { setViewYear(Number(value.slice(0, 4))); setOpen(current => !current); }} className="form-input focus-ring flex items-center justify-between gap-3 text-left"><span className="truncate tabular-nums">{monthLabel(value)}</span><CalendarDays size={16} className="shrink-0 text-muted" /></button>
    {open && <div role="dialog" aria-label="Choose month" className={popoverClass}>
      <PickerHeader title={String(viewYear)} previous={() => setViewYear(year => year - 1)} next={() => setViewYear(year => year + 1)} previousLabel="Previous year" nextLabel="Next year" />
      <div className="grid grid-cols-3 gap-2">{months.map((month, index) => { const key = `${viewYear}-${String(index + 1).padStart(2, "0")}`; const selected = key === value; return <button type="button" key={month} onClick={() => selectMonth(index)} aria-label={`${month} ${viewYear}`} aria-pressed={selected} className={`focus-ring h-10 rounded-md text-xs font-medium transition-colors ${selected ? "bg-accent text-[#09211f]" : "text-[#d5dce3] hover:bg-[#22313e]"} ${key === currentMonth && !selected ? "ring-1 ring-inset ring-gold/60" : ""}`}>{month}</button>; })}</div>
    </div>}
  </div>;
}
