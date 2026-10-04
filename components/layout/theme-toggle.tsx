"use client";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Theme = "light" | "dark";

export function ThemeToggle({ compact = false, mobile = false }: { compact?: boolean; mobile?: boolean }) {
  const [theme, setTheme] = useState<Theme>("dark");
  useEffect(() => {
    const current = document.documentElement.dataset.theme === "light" ? "light" : "dark";
    const timer = window.setTimeout(() => setTheme(current), 0);
    const sync = (event: Event) => setTheme((event as CustomEvent<Theme>).detail);
    window.addEventListener("theme-change", sync);
    return () => { window.clearTimeout(timer); window.removeEventListener("theme-change", sync); };
  }, []);
  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("theme", next);
    window.dispatchEvent(new CustomEvent("theme-change", { detail: next }));
  }
  const label = theme === "dark" ? "Switch to light theme" : "Switch to dark theme";
  if (mobile) return <button type="button" onClick={toggle} aria-label={label} className="focus-ring flex flex-col items-center justify-center gap-1 text-[11px] text-muted hover:text-foreground">{theme === "dark" ? <Sun size={19}/> : <Moon size={19}/>}Theme</button>;
  return <button type="button" onClick={toggle} aria-label={label} title={compact?label:undefined} className={cn("focus-ring flex h-10 w-full items-center rounded-md border border-line bg-surface-raised text-sm text-muted transition-colors hover:text-foreground",compact?"justify-center px-2":"gap-3 px-3")}>{theme === "dark" ? <Sun size={17}/> : <Moon size={17}/>} {!compact&&<span>{theme === "dark" ? "Light theme" : "Dark theme"}</span>}</button>;
}
