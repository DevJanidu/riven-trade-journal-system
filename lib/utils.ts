export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function formatR(value: number) {
  if (value === 0) return "0R";
  return `${value > 0 ? "+" : ""}${Number(value.toFixed(2))}R`;
}

const rrNumberFormatter = new Intl.NumberFormat("en-US", {
  useGrouping: false,
  maximumFractionDigits: 2,
});

export function formatRR(value: number | string | null | undefined): string {
  if (value === null || value === undefined || (typeof value === "string" && value.trim() === "")) return "—";
  const rr = Number(value);
  if (!Number.isFinite(rr)) return "—";
  return `1:${rrNumberFormatter.format(rr === 0 ? 0 : rr)}`;
}

export function formatMoney(value: number) {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toLocaleString("en-US", {
    maximumFractionDigits: 2,
  })}`;
}

export function formatTradeDate(date: string, style: "short" | "long" = "short") {
  return new Intl.DateTimeFormat("en-US", {
    month: style === "short" ? "short" : "long",
    day: style === "short" ? "2-digit" : "numeric",
    ...(style === "long" ? { year: "numeric" } : {}),
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

export function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(key: string) {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${key}-01T00:00:00Z`),
  );
}
