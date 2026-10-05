"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { BarChart3, BookOpen, BrainCircuit, CalendarDays, ChevronLeft, ChevronRight, FileSpreadsheet, ListChecks, LogOut, Settings2 } from "lucide-react";
import { logoutAction } from "@/lib/auth/actions";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./theme-toggle";

const links = [{href:"/dashboard",label:"Dashboard",icon:BarChart3},{href:"/journal",label:"Journal",icon:BookOpen},{href:"/trades",label:"Trades",icon:ListChecks},{href:"/calendar",label:"Calendar",icon:CalendarDays},{href:"/ai-analysis",label:"AI Analysis",icon:BrainCircuit},{href:"/reports",label:"Reports",icon:FileSpreadsheet},{href:"/settings/setups",label:"Setup Types",icon:Settings2}];

export function Sidebar({collapsed,onToggle}:{collapsed:boolean;onToggle:()=>void}) {
  const pathname=usePathname();
  return <aside className={cn("fixed inset-y-0 left-0 z-30 hidden border-r border-line bg-nav transition-[width] duration-200 md:flex md:flex-col",collapsed?"w-[76px]":"w-[220px]")}>
    <div className={cn("flex h-20 items-center border-b border-line",collapsed?"justify-center px-3":"px-6")}><Link href="/dashboard" aria-label="My Journal dashboard" className="focus-ring flex items-center gap-3 overflow-hidden rounded"><Image src="/logo.png" alt="" width={44} height={44} priority className="size-11 shrink-0 rounded-[10px] border border-line bg-surface-elevated object-cover shadow-sm" />{!collapsed&&<p className="whitespace-nowrap text-xs font-semibold tracking-[.18em] text-foreground">MY JOURNAL</p>}</Link></div>
    <button type="button" onClick={onToggle} className="focus-ring absolute -right-3 top-[66px] grid size-6 place-items-center rounded-full border border-line bg-surface-raised text-muted shadow-sm hover:text-foreground" aria-label={collapsed?"Expand sidebar":"Collapse sidebar"} title={collapsed?"Expand sidebar":"Collapse sidebar"}>{collapsed?<ChevronRight size={14}/>:<ChevronLeft size={14}/>}</button>
    <nav className="space-y-1 p-3 pt-6">{links.map(({href,label,icon:Icon})=>{const active=pathname===href||(href==="/trades"&&pathname.startsWith("/trades/"));return <Link key={href} href={href} title={collapsed?label:undefined} className={cn("focus-ring flex items-center rounded-md border py-2.5 text-sm transition-colors",collapsed?"justify-center px-2":"gap-3 px-3",active?"nav-active border-accent/20 bg-accent/8 text-accent":"border-transparent text-muted hover:bg-foreground/[.04] hover:text-foreground")}><Icon className="shrink-0" size={17} strokeWidth={1.8}/>{!collapsed&&<span className="whitespace-nowrap">{label}</span>}</Link>})}</nav>
    <div className={cn("mt-auto",collapsed?"p-3":"p-5")}><ThemeToggle compact={collapsed}/><form action={logoutAction} className="mt-2"><button type="submit" title="Sign out" className={cn("focus-ring flex w-full items-center rounded-md py-2 text-sm text-muted hover:bg-foreground/[.04] hover:text-foreground",collapsed?"justify-center":"gap-3 px-2")}><LogOut size={16}/>{!collapsed&&<span>Sign out</span>}</button></form>{!collapsed&&<div className="mt-4 border-t border-line pt-4"><p className="text-[10px] uppercase tracking-[.18em] text-muted">Process</p><p className="mt-2 text-xs leading-5 text-muted">Trade · Journal · Review<br/>Analyze · Improve</p></div>}</div>
  </aside>;
}
