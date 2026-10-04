"use client";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Sidebar } from "./sidebar";
import { MobileNavigation } from "./mobile-navigation";
export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setCollapsed(localStorage.getItem("sidebar-collapsed") === "true"), 0);
    return () => window.clearTimeout(timer);
  }, []);
  function toggleSidebar() {
    setCollapsed(value => { const next = !value; localStorage.setItem("sidebar-collapsed", String(next)); return next; });
  }
  return <div className="min-h-screen bg-background"><Sidebar collapsed={collapsed} onToggle={toggleSidebar}/><main className={`min-h-screen transition-[padding] duration-200 ${collapsed ? "md:pl-[76px]" : "md:pl-[220px]"}`}><div className="mx-auto w-full max-w-[1564px] px-4 py-6 sm:px-6 md:px-8 md:py-8">{children}</div></main><MobileNavigation/></div>;
}
