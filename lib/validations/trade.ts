import { z } from "zod";
import { directions, emotions, results, sessions } from "@/types/trade";

const twoDecimalPlaces = (value: number) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-7;
const money = z.number().finite().max(9999999999).refine(twoDecimalPlaces, "Use at most two decimal places");
const positiveMoney = money.positive("Must be greater than zero");

export const tradeDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date in YYYY-MM-DD format").refine(value => {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}, "Enter a valid calendar date");

export const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use a month in YYYY-MM format");
export const tradeIdSchema = z.string().uuid("Trade ID must be a UUID");

const optionalUrl = z.union([z.string().url("Enter a valid URL").refine(value => ["http:", "https:"].includes(new URL(value).protocol), "Use an HTTP or HTTPS URL"), z.literal(""), z.null()]).optional().transform(value => value === "" ? null : value);
const optionalScreenshotUrl = z.union([z.string(), z.literal(null)]).optional().refine(value => {
  if (value === null || value === undefined) return true;
  if (value.length > 2048) return false;
  if (value.startsWith("/") && !value.startsWith("//") && !value.includes("..")) return true;
  if (/^trades\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(png|jpg|webp)$/i.test(value)) return true;
  try { return ["http:", "https:"].includes(new URL(value).protocol); } catch { return false; }
}, "Provide a valid screenshot key or HTTP(S) URL");
const note = z.string().max(10000, "Keep this note under 10,000 characters").default("");

const editableTradeFields = z.object({
  instrument: z.literal("XAUUSD"),
  date: tradeDateSchema,
  session: z.enum(sessions),
  direction: z.enum(directions),
  entry: positiveMoney,
  stopLoss: positiveMoney,
  takeProfit: positiveMoney,
  riskAmount: positiveMoney,
  profitLoss: money,
  result: z.enum(results).optional(),
  profitBooked: money.nonnegative().default(0),
  breakEvenAfterProfit: z.boolean().default(false),
  setup: z.string().trim().min(1, "Choose a setup").max(80, "Keep setup names under 80 characters"),
  setupGrade: z.enum(["A", "A+"]).optional(),
  setupChecklist: z.array(z.string().max(200)).max(50).default([]),
  setupAvoidChecklist: z.array(z.string().max(200)).max(50).default([]),
  psychologyReady: z.boolean().default(false),
  psychologyAnswer: z.string().max(500).default(""),
  tradingViewUrl: optionalUrl,
  beforeScreenshot: optionalScreenshotUrl,
  afterScreenshot: optionalScreenshotUrl,
  entryReason: note,
  wentWell: note,
  wentWrong: note,
  improvement: note,
  followedRules: z.boolean(),
  emotion: z.enum(emotions),
}).strict();

export const createTradeSchema = editableTradeFields.superRefine((trade, context) => {
  if (trade.breakEvenAfterProfit && (trade.profitLoss !== 0 || trade.profitBooked <= 0)) context.addIssue({ code: "custom", path: ["breakEvenAfterProfit"], message: "Profit-booked break even requires zero final P/L and a positive booked-profit amount" });
  if (trade.profitLoss !== 0 && trade.breakEvenAfterProfit) context.addIssue({ code: "custom", path: ["profitLoss"], message: "Clear profit-booked break even when final P/L is not zero" });
  if (trade.direction === "Long") {
    if (trade.stopLoss >= trade.entry) context.addIssue({ code: "custom", path: ["stopLoss"], message: "For a long trade, stop loss must be below entry" });
    if (trade.takeProfit <= trade.entry) context.addIssue({ code: "custom", path: ["takeProfit"], message: "For a long trade, take profit must be above entry" });
  } else {
    if (trade.stopLoss <= trade.entry) context.addIssue({ code: "custom", path: ["stopLoss"], message: "For a short trade, stop loss must be above entry" });
    if (trade.takeProfit >= trade.entry) context.addIssue({ code: "custom", path: ["takeProfit"], message: "For a short trade, take profit must be below entry" });
  }
});

export const updateTradeSchema = z.object({
  ...editableTradeFields.shape,
  profitBooked: money.nonnegative(),
  breakEvenAfterProfit: z.boolean(),
  setupChecklist: z.array(z.string().max(200)).max(50),
  setupAvoidChecklist: z.array(z.string().max(200)).max(50),
  psychologyReady: z.boolean(),
  psychologyAnswer: z.string().max(500),
  entryReason: z.string().max(10000),
  wentWell: z.string().max(10000),
  wentWrong: z.string().max(10000),
  improvement: z.string().max(10000),
}).partial().strict().refine(value => Object.keys(value).length > 0, "Provide at least one field to update");

export const tradeQuerySchema = z.object({
  month: monthSchema.optional(),
  session: z.enum(sessions).optional(),
  setup: z.string().trim().min(1).max(80).optional(),
  result: z.enum(results).optional(),
  direction: z.enum(directions).optional(),
}).strict();

export const dashboardQuerySchema = z.object({ month: monthSchema.optional() }).strict();

export type CreateTradeInput = z.infer<typeof createTradeSchema>;
export type UpdateTradeInput = z.infer<typeof updateTradeSchema>;
export type TradeQuery = z.infer<typeof tradeQuerySchema>;
