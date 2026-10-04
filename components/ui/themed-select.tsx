"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

type Option = string | { value: string; label: string };
type ThemedSelectProps = {
  label: string;
  options: readonly Option[];
  name?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  variant?: "field" | "filter" | "inline";
  tone?: "default" | "setup";
};

export function ThemedSelect({ label, options, name, value, defaultValue, onValueChange, variant = "field", tone = "default" }: ThemedSelectProps) {
  const items = options.map(option => typeof option === "string" ? { value: option, label: option } : option);
  const [internalValue, setInternalValue] = useState(defaultValue ?? items[0]?.value ?? "");
  const selectedValue = value ?? internalValue;
  const selected = items.find(item => item.value === selectedValue) ?? items[0];
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      } else if (event.key === "Tab") {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function choose(nextValue: string) {
    if (value === undefined) setInternalValue(nextValue);
    onValueChange?.(nextValue);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setActiveIndex(Math.max(0, items.findIndex(item => item.value === selectedValue)));
        setOpen(true);
      } else {
        setActiveIndex(index => (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length);
      }
    } else if (open && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      choose(items[activeIndex]?.value ?? selectedValue);
    } else if (open && event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
    } else if (open && event.key === "End") {
      event.preventDefault();
      setActiveIndex(items.length - 1);
    }
  }

  const inline = variant === "inline";
  const labelClass = inline ? "text-xs text-muted" : variant === "filter" ? "mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-muted" : "mb-2 block text-sm font-medium text-[#cbd3d8]";

  return <div ref={containerRef} className={`relative min-w-0 ${inline ? "flex items-center gap-2" : ""}`}>
    <span className={labelClass}>{label}</span>
    {name && <input type="hidden" name={name} value={selectedValue} />}
    <button
      ref={triggerRef}
      type="button"
      role="combobox"
      aria-label={`${label}: ${selected?.label ?? ""}`}
      aria-expanded={open}
      aria-controls={listboxId}
      aria-haspopup="listbox"
      aria-activedescendant={open ? `${listboxId}-option-${activeIndex}` : undefined}
      onClick={() => { setActiveIndex(Math.max(0, items.findIndex(item => item.value === selectedValue))); setOpen(current => !current); }}
      onKeyDown={handleKeyDown}
      className={`form-input focus-ring flex items-center justify-between gap-3 text-left ${inline ? "!h-9 min-w-32" : ""}`}
    >
      <span className={`truncate ${tone === "setup" ? "font-medium text-setup" : ""}`}>{selected?.label}</span><ChevronDown size={16} className={`shrink-0 text-muted transition-transform ${open ? "rotate-180 text-accent" : ""}`} />
    </button>
    {open && <div id={listboxId} role="listbox" aria-label={label} className={`absolute top-[calc(100%+8px)] z-50 max-h-64 overflow-y-auto rounded-[10px] border border-[#314253] bg-[#111922] p-1.5 shadow-[0_18px_40px_rgba(0,0,0,.32)] ${inline ? "right-0 w-48" : "left-0 w-full min-w-48"}`}>
      {items.map((item, index) => <button
        id={`${listboxId}-option-${index}`}
        type="button"
        role="option"
        aria-selected={item.value === selectedValue}
        key={item.value}
        onMouseEnter={() => setActiveIndex(index)}
        onClick={() => choose(item.value)}
        className={`focus-ring flex min-h-9 w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-xs transition-colors ${item.value === selectedValue ? tone === "setup" ? "bg-setup/10 font-medium text-setup" : "bg-accent/10 font-medium text-accent" : index === activeIndex ? "bg-[#22313e] text-white" : "text-[#d5dce3] hover:bg-[#22313e]"}`}
      >{item.label}{item.value === selectedValue && <Check size={14} className="shrink-0" />}</button>)}
    </div>}
  </div>;
}
