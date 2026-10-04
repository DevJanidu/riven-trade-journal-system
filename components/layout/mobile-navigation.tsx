"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, BookOpen, ListChecks, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./theme-toggle";
const links=[{href:"/dashboard",label:"Dashboard",icon:BarChart3},{href:"/journal",label:"Journal",icon:BookOpen},{href:"/trades",label:"Trades",icon:ListChecks},{href:"/settings/setups",label:"Setups",icon:Settings2}];
export function MobileNavigation(){const pathname=usePathname();return <nav className="fixed inset-x-0 bottom-0 z-40 grid h-[66px] grid-cols-5 border-t border-line bg-nav/95 px-2 backdrop-blur md:hidden">{links.map(({href,label,icon:Icon})=>{const active=pathname===href||(href==="/trades"&&pathname.startsWith("/trades/"));return <Link key={href} href={href} className={cn("focus-ring flex flex-col items-center justify-center gap-1 text-[11px]",active?"text-accent":"text-muted")}><Icon size={19}/>{label}</Link>})}<ThemeToggle mobile/></nav>}
