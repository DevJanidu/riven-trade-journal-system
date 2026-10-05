import assert from "node:assert/strict";
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { createSessionToken, sessionCookieName } from "../lib/auth/token";
import type { CalendarData } from "../types/calendar";
import type { Trade } from "../types/trade";

config({ path: ".env.development.local", quiet: true });
config({ path: ".env", quiet: true });
const sql = neon(process.env.DATABASE_URL!);
const baseUrl = process.env.TEST_BASE_URL ?? "http://localhost:3000";

async function main() {
  const users: string[] = [];
  async function request<T>(path: string, userId?: string, method = "GET", body?: unknown): Promise<T> {
    const response = await fetch(`${baseUrl}${path}`, {
      method, cache: "no-store", redirect: "manual",
      headers: { ...(userId ? { Cookie: `${sessionCookieName}=${await createSessionToken(userId, "test-account-no-login")}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const json = await response.json();
    assert.ok(response.ok && json.success, `${method} ${path}: ${response.status} ${JSON.stringify(json)}`);
    if (path.startsWith("/api/calendar")) assert.equal(response.headers.get("cache-control"), "private, no-store");
    return json.data;
  }
  try {
    assert.equal((await fetch(`${baseUrl}/api/calendar?month=2026-10`, { redirect: "manual" })).status, 401);
    assert.equal((await fetch(`${baseUrl}/calendar`, { redirect: "manual" })).status, 307);
    for (const name of ["A", "B"]) {
      const [user] = await sql`INSERT INTO users (name, email, password_hash) VALUES (${`Calendar test ${name}`}, ${`calendar-${crypto.randomUUID()}@example.invalid`}, 'test-account-no-login') RETURNING id`;
      users.push(user.id);
    }
    const [a, b] = users;
    const fixture = { instrument: "XAUUSD", session: "London", direction: "Long", entry: 4000, stopLoss: 3990, takeProfit: 4020, riskAmount: 25, setup: "Calendar test", followedRules: true, emotion: "Calm" };
    async function create(user: string, date: string, r: number) {
      return request<Trade>("/api/trades", user, "POST", { ...fixture, date, profitLoss: r * 25 });
    }
    const calendar = (user: string, month = "2026-10") => request<CalendarData>(`/api/calendar?month=${month}`, user);
    assert.equal((await calendar(a)).summary.totalTrades, 0);
    const one = await create(a, "2026-10-05", 2.5);
    assert.equal((await calendar(a)).days[0].netR, 2.5);
    await create(a, "2026-10-05", -1);
    await create(a, "2026-10-05", 1.7);
    await create(a, "2026-10-05", 0);
    await create(b, "2026-10-05", 9);
    const mixed = (await calendar(a)).days[0];
    assert.deepEqual(mixed, { date: "2026-10-05", tradeCount: 4, wins: 2, losses: 1, breakEvens: 1, netR: 3.2 });
    assert.equal((await calendar(b)).days[0].netR, 9);
    assert.equal((await calendar(a)).summary.winRate, 66.67);
    // Positive day with more losses; negative day with more wins; exactly zero.
    for (const [date, outcomes] of [
      ["2026-10-06", [3, -1, -1]], ["2026-10-07", [1, 1, -3]],
      ["2026-10-08", [1, -1]], ["2026-10-09", [0, 0]],
      ["2026-10-10", [1, 2]], ["2026-10-11", [-1, -2]],
    ] as const) for (const r of outcomes) await create(a, date, r);
    const days = (await calendar(a)).days;
    assert.equal(days.find(day => day.date.endsWith("06"))?.netR, 1);
    assert.equal(days.find(day => day.date.endsWith("07"))?.netR, -1);
    assert.equal(days.find(day => day.date.endsWith("08"))?.netR, 0);
    assert.equal(days.find(day => day.date.endsWith("09"))?.breakEvens, 2);
    assert.equal(days.find(day => day.date.endsWith("10"))?.wins, 2);
    assert.equal(days.find(day => day.date.endsWith("11"))?.losses, 2);
    const daily = await request<Trade[]>("/api/trades?date=2026-10-05&month=2026-09", a);
    assert.equal(daily.length, 4);
    assert.ok(daily.every(trade => trade.date === "2026-10-05" && trade.actualR !== 9));
    assert.equal((await request<Trade[]>("/api/trades?date=2026-10-05&result=Loss", a)).length, 1);
    const foreign = await fetch(`${baseUrl}/api/trades/${one.id}`, { headers: { Cookie: `${sessionCookieName}=${await createSessionToken(b, "test-account-no-login")}` } });
    assert.equal(foreign.status, 404);
    await request(`/api/trades/${one.id}`, a, "PATCH", { profitLoss: 50 });
    assert.equal((await calendar(a)).days[0].netR, 2.7);
    await request(`/api/trades/${one.id}`, a, "PATCH", { date: "2026-10-12" });
    assert.equal((await calendar(a)).days[0].tradeCount, 3);
    assert.equal((await calendar(a)).days.find(day => day.date === "2026-10-12")?.netR, 2);
    await request(`/api/trades/${one.id}`, a, "PATCH", { date: "2026-11-01" });
    assert.ok(!(await calendar(a)).days.some(day => day.date === "2026-10-12"));
    assert.equal((await calendar(a, "2026-11")).days[0].netR, 2);
    await request(`/api/trades/${one.id}`, a, "DELETE");
    assert.equal((await calendar(a, "2026-11")).summary.totalTrades, 0);
    const cookie = `${sessionCookieName}=${await createSessionToken(a, "test-account-no-login")}`;
    const html = await (await fetch(`${baseUrl}/trades?date=2026-10-05`, { headers: { Cookie: cookie } })).text();
    assert.ok(html.includes("Back to Calendar"));
    assert.ok(html.includes("/calendar?month=2026-10"));
    assert.ok(html.includes("Trades — October 5, 2026"));
    const invalid = await fetch(`${baseUrl}/api/calendar?month=2026-10&userId=${b}`, { headers: { Cookie: cookie } });
    assert.equal(invalid.status, 422);
    console.info("Calendar integration passed: authentication, isolation, SQL date filters, aggregate outcomes, create/edit/date move/delete refresh, daily title and calendar back link.");
  } finally {
    for (const id of users) await sql`DELETE FROM users WHERE id = ${id}`;
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
