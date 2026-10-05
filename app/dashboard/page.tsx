import type { Metadata } from "next";
import { TradingDashboard } from "@/components/dashboard/trading-dashboard";
import { getMonthlyTrades } from "@/lib/data/trades";
import { monthSchema } from "@/lib/validations/trade";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { month: requestedMonth } = await searchParams;
  const month = monthSchema.safeParse(requestedMonth).success ? requestedMonth! : new Date().toISOString().slice(0, 7);
  const [trades, user] = await Promise.all([getMonthlyTrades(month), requireUser()]);
  const firstName = user.name.trim().split(/\s+/)[0] || "Trader";
  return <TradingDashboard month={month} trades={trades} firstName={firstName} />;
}
