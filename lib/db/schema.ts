import { sql } from "drizzle-orm";
import { boolean, check, date, index, jsonb, numeric, pgEnum, pgTable, text, timestamp, uuid, uniqueIndex } from "drizzle-orm/pg-core";
import { directions, emotions, results, sessions } from "@/types/trade";

export const sessionEnum = pgEnum("trade_session", sessions);
export const directionEnum = pgEnum("trade_direction", directions);
export const resultEnum = pgEnum("trade_result", results);
export const emotionEnum = pgEnum("trade_emotion", emotions);

export const setupTypes = pgTable("setup_types", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  rules: jsonb("rules").$type<string[]>().notNull().default([]),
  avoidRules: jsonb("avoid_rules").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
}, table => [uniqueIndex("setup_types_name_idx").on(table.name)]);

export const tradeDrafts = pgTable("trade_drafts", {
  id: uuid("id").defaultRandom().primaryKey(),
  date: date("date", { mode: "string" }).notNull(),
  data: jsonb("data").$type<import("@/lib/validations/draft").DraftInput>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
}, table => [index("trade_drafts_date_idx").on(table.date)]);

export const trades = pgTable("trades", {
  id: uuid("id").defaultRandom().primaryKey(),
  date: date("date", { mode: "string" }).notNull(),
  instrument: text("instrument").notNull().default("XAUUSD"),
  session: sessionEnum("session").notNull(),
  direction: directionEnum("direction").notNull(),
  entry: numeric("entry", { precision: 12, scale: 2 }).notNull(),
  stopLoss: numeric("stop_loss", { precision: 12, scale: 2 }).notNull(),
  takeProfit: numeric("take_profit", { precision: 12, scale: 2 }).notNull(),
  riskAmount: numeric("risk_amount", { precision: 12, scale: 2 }).notNull(),
  plannedRR: numeric("planned_rr", { precision: 12, scale: 4 }).notNull(),
  actualR: numeric("actual_r", { precision: 12, scale: 4 }).notNull(),
  profitLoss: numeric("profit_loss", { precision: 14, scale: 2 }).notNull(),
  profitBooked: numeric("profit_booked", { precision: 14, scale: 2 }).notNull().default("0"),
  breakEvenAfterProfit: boolean("break_even_after_profit").notNull().default(false),
  result: resultEnum("result").notNull(),
  setup: text("setup").notNull(),
  setupGrade: text("setup_grade"),
  setupChecklist: jsonb("setup_checklist").$type<string[]>().notNull().default([]),
  setupAvoidChecklist: jsonb("setup_avoid_checklist").$type<string[]>().notNull().default([]),
  psychologyReady: boolean("psychology_ready").notNull().default(false),
  psychologyAnswer: text("psychology_answer").notNull().default(""),
  tradingViewUrl: text("trading_view_url"),
  beforeScreenshot: text("before_screenshot"),
  afterScreenshot: text("after_screenshot"),
  entryReason: text("entry_reason").notNull().default(""),
  wentWell: text("went_well").notNull().default(""),
  wentWrong: text("went_wrong").notNull().default(""),
  improvement: text("improvement").notNull().default(""),
  followedRules: boolean("followed_rules").notNull(),
  emotion: emotionEnum("emotion").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
}, table => [
  index("trades_date_created_idx").on(table.date, table.createdAt),
  index("trades_session_idx").on(table.session),
  index("trades_setup_idx").on(table.setup),
  index("trades_result_idx").on(table.result),
  index("trades_direction_idx").on(table.direction),
  check("trades_xauusd_only", sql`${table.instrument} = 'XAUUSD'`),
  check("trades_entry_positive", sql`${table.entry} > 0`),
  check("trades_stop_loss_positive", sql`${table.stopLoss} > 0`),
  check("trades_take_profit_positive", sql`${table.takeProfit} > 0`),
  check("trades_risk_amount_positive", sql`${table.riskAmount} > 0`),
  check("trades_planned_rr_nonnegative", sql`${table.plannedRR} >= 0`),
]);

export type TradeRow = typeof trades.$inferSelect;
