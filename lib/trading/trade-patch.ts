import type { Trade } from "@/types/trade";

const defaults: Record<string, unknown> = {
  profitBooked: 0,
  breakEvenAfterProfit: false,
  setupChecklist: [],
  setupAvoidChecklist: [],
  psychologyReady: false,
  psychologyAnswer: "",
  tradingViewUrl: null,
  beforeScreenshot: null,
  afterScreenshot: null,
};

export function buildTradePatch(original: Trade, current: Record<string, unknown>): Record<string, unknown> {
  const previous = original as unknown as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(current)) {
    if (value === undefined) continue;
    const oldValue = (key === "tradingViewUrl" || key === "beforeScreenshot" || key === "afterScreenshot") && previous[key] === ""
      ? null
      : previous[key] ?? defaults[key];
    const same = Array.isArray(value) && Array.isArray(oldValue)
      ? JSON.stringify(value) === JSON.stringify(oldValue)
      : Object.is(value, oldValue);
    if (!same) patch[key] = value;
  }
  return patch;
}
