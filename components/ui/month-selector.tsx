"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { monthLabel } from "@/lib/utils";

export function MonthSelector({ month }: { month:string }) {
  const router=useRouter(); const pathname=usePathname(); const params=useSearchParams();
  function move(offset:number){const [year,value]=month.split("-").map(Number);const date=new Date(year,value-1+offset,1);const next=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}`;const query=new URLSearchParams(params.toString());query.set("month",next);router.push(`${pathname}?${query.toString()}`)}
  return <div className="inline-flex items-center gap-1 rounded-[9px] border border-line bg-surface p-1"><button onClick={()=>move(-1)} aria-label="Previous month" className="focus-ring grid size-8 place-items-center rounded-md text-muted hover:bg-surface-secondary hover:text-foreground"><ChevronLeft size={17}/></button><span className="min-w-36 text-center text-sm font-medium tabular-nums text-foreground">{monthLabel(month)}</span><button onClick={()=>move(1)} aria-label="Next month" className="focus-ring grid size-8 place-items-center rounded-md text-muted hover:bg-surface-secondary hover:text-foreground"><ChevronRight size={17}/></button></div>;
}
