"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, BookOpen, BrainCircuit, CalendarDays, FileSpreadsheet, ListChecks, LogOut, Settings2 } from "lucide-react";
import { logoutAction } from "@/lib/auth/actions";
import { cn } from "@/lib/utils";

const links=[{href:"/dashboard",label:"Dashboard",icon:BarChart3},{href:"/journal",label:"Journal",icon:BookOpen},{href:"/trades",label:"Trades",icon:ListChecks},{href:"/calendar",label:"Calendar",icon:CalendarDays},{href:"/ai-analysis",label:"AI Analysis",icon:BrainCircuit},{href:"/reports",label:"Reports",icon:FileSpreadsheet},{href:"/settings/setups",label:"Setups",icon:Settings2}];
export function MobileNavigation(){const pathname=usePathname();return <nav className="fixed inset-x-0 bottom-0 z-40 flex h-[66px] overflow-x-auto border-t border-line bg-nav/95 px-1 backdrop-blur md:hidden">{links.map(({href,label,icon:Icon})=>{const active=pathname===href||(href==="/trades"&&pathname.startsWith("/trades/"));return <Link key={href} href={href} className={cn("focus-ring flex min-w-[64px] flex-1 flex-col items-center justify-center gap-1 px-1 text-[10px]",active?"text-accent":"text-muted")}><Icon size={18}/><span className="whitespace-nowrap">{label}</span></Link>})}<form action={logoutAction} className="flex min-w-[64px] flex-1"><button type="submit" className="focus-ring flex flex-1 flex-col items-center justify-center gap-1 px-1 text-[10px] text-muted"><LogOut size={18}/><span className="whitespace-nowrap">Sign out</span></button></form></nav>}
