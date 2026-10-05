import assert from "node:assert/strict";
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { z } from "zod";
import { collectSnapshot } from "../lib/market-data/snapshot";
import { getHighImpactEvents } from "../lib/market-data/finance-calendar";
import { analyzeGold, analysisRequest, goldAnalysisModel } from "../lib/ai/gold-analysis";
import { goldWeeklyAnalysisSchema, technicalContextSchema } from "../lib/ai/schemas";
import type { GoldAnalysisSnapshot } from "../lib/market-data/types";
import { getGoldAnalysisById, getAnalysisHistory, saveGoldAnalysis } from "../lib/data/gold-analyses";
import { createSessionToken, sessionCookieName } from "../lib/auth/token";
import { checkAiBrowser } from "./check-ai-browser";

config({ path: ".env.development.local", quiet: true }); config({ path: ".env", quiet: true });
async function main() {
  const replay = process.argv.includes("--replay") ? JSON.parse(await readFile(".ai-artifacts/finance-calendar-analysis.json", "utf8")) as { snapshot: GoldAnalysisSnapshot; analysis: unknown } : null;
  const snapshot = replay?.snapshot ?? await collectSnapshot(); const calendar = snapshot.economicCalendar;
  assert.ok(calendar, "Live FinanceCalendar snapshot must be available");
  assert.ok(!snapshot.dataQuality.missingData.includes("Upcoming economic calendar"));
  assert.ok(snapshot.dataQuality.missingData.includes("Live news feed"));
  assert.ok(snapshot.dataQuality.missingData.includes("Market-implied Fed probabilities"));
  const high = await getHighImpactEvents(snapshot.weekStart, snapshot.weekEnd);
  const context = technicalContextSchema.parse({});
  assert.deepEqual(JSON.parse(analysisRequest(snapshot).input[1].content).snapshot.economicCalendar, calendar);
  console.info(JSON.stringify({ week: calendar.week, calendar: { relevantEvents: calendar.events.length, highImpactEvents: high.events.length, eventRisk: calendar.eventRisk, consensusCoverage: calendar.consensusCoverage }, providers: { gold: !!snapshot.gold, fred: Object.keys(snapshot.macro).length, cftc: !!snapshot.positioning }, dataQuality: snapshot.dataQuality }, null, 2));
  if (!process.argv.includes("--analyze") && !replay) { console.info("Live provider/input check passed. Zero OpenAI requests. Add --analyze for one paid structured generation plus database/browser verification."); return; }
  // One intentionally requested integration check. Never call the model once per event.
  const replayAnalysis = replay ? z.record(z.string(), z.unknown()).parse(replay.analysis) : null;
  if (replayAnalysis) delete replayAnalysis.dataQuality;
  const analysis = replayAnalysis ? { ...goldWeeklyAnalysisSchema.parse(replayAnalysis), dataQuality: snapshot.dataQuality } : await analyzeGold(snapshot);
  assert.equal(Object.values(analysis.probabilities).reduce((a, b) => a + b, 0), 100);
  const client = neon(process.env.DATABASE_URL!); const ids: string[] = [];
  try {
    for (const name of ["Calendar integration A", "Calendar integration B"]) {
      const [user] = await client`INSERT INTO users (name, email, password_hash) VALUES (${name}, ${`calendar-${crypto.randomUUID()}@example.invalid`}, 'test-no-login') RETURNING id`;
      ids.push(String(user.id));
    }
    const saved = await saveGoldAnalysis(ids[0], snapshot, analysis, context, goldAnalysisModel());
    assert.deepEqual(saved.dataSnapshot.economicCalendar, calendar);
    assert.equal(await getGoldAnalysisById(ids[1], saved.id), null);
    assert.equal((await getAnalysisHistory(ids[1])).length, 0);
    const original = JSON.stringify(saved.dataSnapshot);
    await collectSnapshot(); // Cached provider reads cannot overwrite a saved analysis.
    assert.equal(JSON.stringify((await getGoldAnalysisById(ids[0], saved.id))?.dataSnapshot), original);
    await mkdir(".ai-artifacts", { recursive: true });
    await writeFile(".ai-artifacts/finance-calendar-analysis.json", JSON.stringify({ snapshot, analysis, context }, null, 2));
    const base = process.env.TEST_BASE_URL ?? "http://localhost:3000";
    const tokenA = await createSessionToken(ids[0], "test-no-login");
    const tokenB = await createSessionToken(ids[1], "test-no-login");
    const headersA = { Cookie: `${sessionCookieName}=${tokenA}` };
    const foreign = await fetch(`${base}/api/ai-analysis/${saved.id}`, { headers: { Cookie: `${sessionCookieName}=${tokenB}` } });
    assert.equal(foreign.status, 404, "Foreign calendar snapshots must be denied through the authenticated API");
    const responses = await Promise.all(["/dashboard", "/journal", "/trades", "/calendar", "/reports", "/api/ai-analysis/current", "/api/ai-analysis/history", `/api/ai-analysis/${saved.id}`].map(async route => ({ route, status: (await fetch(`${base}${route}`, { headers: headersA })).status })));
    for (const response of responses) assert.equal(response.status, 200, `${response.route} remains accessible`);
    await checkAiBrowser(base, tokenA, saved.id, true);
    const deleteUrl = `${base}/api/ai-analysis/${saved.id}`;
    assert.equal((await fetch(deleteUrl, { method: "DELETE" })).status, 401);
    assert.equal((await fetch(deleteUrl, { method: "DELETE", headers: { Cookie: `${sessionCookieName}=${tokenB}` } })).status, 404, "User B cannot delete User A's report");
    assert.ok(await getGoldAnalysisById(ids[0], saved.id), "Foreign deletion leaves the report intact");
    assert.equal((await fetch(`${base}/api/ai-analysis/invalid-id`, { method: "DELETE", headers: headersA })).status, 400);
    assert.equal((await fetch(deleteUrl, { method: "DELETE", headers: { ...headersA, Origin: "https://invalid.example" } })).status, 403);
    assert.equal((await fetch(deleteUrl, { method: "DELETE", headers: headersA })).status, 200);
    assert.equal(await getGoldAnalysisById(ids[0], saved.id), null);
    assert.equal((await getAnalysisHistory(ids[0])).length, 0);
    assert.equal((await fetch(deleteUrl, { method: "DELETE", headers: headersA })).status, 404);
    console.info("Analysis deletion passed: owner-only, authenticated, UUID/origin validated, report removed from history; foreign/repeated deletion denied.");
    console.info(`${replay ? "Saved structured output replayed with zero new OpenAI requests." : "One structured OpenAI request passed."} Calendar snapshot save/read, A/B isolation, history immutability, attribution and desktop/mobile UI passed.`);
  } finally {
    for (const id of ids) await client`DELETE FROM users WHERE id = ${id}`;
    console.info("Temporary test accounts and reports removed.");
  }
}
main().catch(error => { if (error instanceof assert.AssertionError) console.error(`Assertion failed: ${error.message.slice(0, 250)}`); console.error("FinanceCalendar integration check failed. No secrets printed."); process.exitCode = 1; });
