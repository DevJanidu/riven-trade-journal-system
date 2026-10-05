"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, BookOpen, CalendarDays, ListChecks, LogOut, Settings2 } from "lucide-react";
import { logoutAction } from "@/lib/auth/actions";
import { cn } from "@/lib/utils";

const links=[{href:"/dashboard",label:"Dashboard",icon:BarChart3},{href:"/journal",label:"Journal",icon:BookOpen},{href:"/trades",label:"Trades",icon:ListChecks},{href:"/calendar",label:"Calendar",icon:CalendarDays},{href:"/settings/setups",label:"Setups",icon:Settings2}];
export function MobileNavigation(){const pathname=usePathname();return <nav className="fixed inset-x-0 bottom-0 z-40 grid h-[66px] grid-cols-6 border-t border-line bg-nav/95 px-2 backdrop-blur md:hidden">{links.map(({href,label,icon:Icon})=>{const active=pathname===href||(href==="/trades"&&pathname.startsWith("/trades/"));return <Link key={href} href={href} className={cn("focus-ring flex flex-col items-center justify-center gap-1 text-[11px]",active?"text-accent":"text-muted")}><Icon size={19}/>{label}</Link>})}<form action={logoutAction} className="flex"><button type="submit" className="focus-ring flex flex-1 flex-col items-center justify-center gap-1 text-[11px] text-muted"><LogOut size={19}/>Sign out</button></form></nav>}
