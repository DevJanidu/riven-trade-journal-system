import assert from "node:assert/strict";
import test from "node:test";
import { calendarCells, calendarData, calendarDate, dayTone, shiftMonth } from "../lib/trading/calendar";
import { tradeQuerySchema, dashboardQuerySchema } from "../lib/validations/trade";
import { monthBounds } from "../lib/trading/calculations";

for (const [month, first, count] of [
  ["2026-06", 0, 30], // Monday
  ["2026-02", 6, 28], // Sunday, non-leap February
  ["2024-02", 3, 29], // Leap February
  ["2026-10", 3, 31],
  ["2026-11", 6, 30],
] as const) {
  test(`${month}: Monday-first alignment and ${count} days`, () => {
    const cells = calendarCells(month);
    assert.equal(cells.indexOf(`${month}-01`), first);
    assert.equal(cells.filter(Boolean).length, count);
    assert.equal(cells.length % 7, 0);
    assert.ok(cells.includes(`${month}-${count}`));
    assert.ok(cells.every(date => date === null || date.startsWith(month)));
  });
}

test("month navigation crosses year boundaries in both directions", () => {
  assert.equal(shiftMonth("2026-12", 1), "2027-01");
  assert.equal(shiftMonth("2026-01", -1), "2025-12");
});

test("four-digit years preserve their value and navigation stays within valid ISO months", () => {
  assert.deepEqual(monthBounds("0042-12"), { start: "0042-12-01", end: "0043-01-01" });
  assert.equal(calendarCells("9999-12").filter(Boolean).length, 31);
  assert.equal(shiftMonth("9999-12", 1), "9999-12");
  assert.equal(shiftMonth("0001-01", -1), "0001-01");
  assert.equal(dashboardQuerySchema.safeParse({ month: "0000-01" }).success, false);
});

test("date-only arithmetic preserves the exact trade date", () => {
  assert.equal(calendarDate("2026-10-05").toISOString(), "2026-10-05T00:00:00.000Z");
  assert.equal(calendarDate("2026-10-05").getUTCDay(), 1);
});

test("empty month has zero statistics", () => {
  assert.deepEqual(calendarData("2026-10", []).summary, {
    tradingDays: 0, totalTrades: 0, wins: 0, losses: 0, breakEvens: 0, winRate: 0, netR: 0,
  });
});

test("monthly summary adds daily counts and R with existing win-rate definition", () => {
  const data = calendarData("2026-10", [
    { date: "2026-10-05", tradeCount: 3, wins: 2, losses: 1, breakEvens: 0, netR: 3.2 },
    { date: "2026-10-06", tradeCount: 3, wins: 1, losses: 1, breakEvens: 1, netR: -1.7 },
  ]);
  assert.deepEqual(data.summary, { tradingDays: 2, totalTrades: 6, wins: 3, losses: 2, breakEvens: 1, winRate: 60, netR: 1.5 });
});

test("day classification uses R rather than win/loss majority", () => {
  assert.equal(dayTone(2), "profit");
  assert.equal(dayTone(-2), "loss");
  assert.equal(dayTone(0), "neutral");
  assert.equal(dayTone(-0), "neutral");
});

test("R precision makes cancelling fractions exactly zero", () => {
  const data = calendarData("2026-10", [0.1, 0.2, -0.3].map((netR, index) => ({
    date: `2026-10-0${index + 1}`, tradeCount: 1, wins: netR > 0 ? 1 : 0,
    losses: netR < 0 ? 1 : 0, breakEvens: 0, netR,
  })));
  assert.equal(data.summary.netR, 0);
});

test("all break-even trades have zero win rate without division by zero", () => {
  assert.equal(calendarData("2026-10", [{ date: "2026-10-05", tradeCount: 3, wins: 0, losses: 0, breakEvens: 3, netR: 0 }]).summary.winRate, 0);
});

test("exact date validation rejects impossible dates and browser-supplied ownership", () => {
  assert.ok(tradeQuerySchema.safeParse({ date: "2024-02-29", session: "London" }).success);
  for (const date of ["2026-02-29", "2026-10-32", "2026-13-01", "2026-1-05"]) assert.equal(tradeQuerySchema.safeParse({ date }).success, false);
  assert.equal(tradeQuerySchema.safeParse({ date: "2026-10-05", userId: "another-user" }).success, false);
  assert.equal(dashboardQuerySchema.safeParse({ month: "2026-10", userId: "another-user" }).success, false);
  assert.equal(dashboardQuerySchema.safeParse({ month: "2026-13" }).success, false);
});
