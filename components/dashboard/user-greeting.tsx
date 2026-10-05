"use client";

import { useEffect, useState } from "react";
import { Moon, Sparkles, Sun, Sunrise, Sunset } from "lucide-react";

const greetings = {
  morning: { title: "Good morning", message: "Start with a clear plan. Let patience guide your trades.", icon: Sunrise },
  afternoon: { title: "Good afternoon", message: "Stay selective and trust your process. Every thoughtful decision counts.", icon: Sun },
  evening: { title: "Good evening", message: "Take a moment to reflect on what worked and what you learned today.", icon: Sunset },
  night: { title: "Good night", message: "Give yourself room to recharge. Tomorrow brings a fresh perspective.", icon: Moon },
};

export function UserGreeting({ firstName }: { firstName: string }) {
  const [period, setPeriod] = useState<keyof typeof greetings | null>(null);
  useEffect(() => {
    function update() {
      const hour = new Date().getHours();
      setPeriod(hour >= 5 && hour < 12 ? "morning" : hour < 17 && hour >= 12 ? "afternoon" : hour >= 17 && hour < 21 ? "evening" : "night");
    }
    const timer = window.setTimeout(update, 0);
    const interval = window.setInterval(update, 60000);
    window.addEventListener("focus", update);
    return () => { window.clearTimeout(timer); window.clearInterval(interval); window.removeEventListener("focus", update); };
  }, []);
  const greeting = period ? greetings[period] : { title: "Welcome back", message: "A clear plan and a thoughtful review go a long way.", icon: Sparkles };
  const Icon = greeting.icon;
  return <section aria-label="Personal greeting" className="flex items-center gap-4 rounded-xl border border-accent/15 bg-linear-to-r from-accent/8 via-surface to-surface px-4 py-4 sm:px-5">
    <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-gold/20 bg-gold/8 text-gold"><Icon size={23} strokeWidth={1.6} aria-hidden="true" /></span>
    <div><p className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">{greeting.title}, <span className="text-accent">{firstName}</span>.</p><p className="mt-1 text-xs leading-5 text-muted sm:text-sm">{greeting.message}</p></div>
  </section>;
}
