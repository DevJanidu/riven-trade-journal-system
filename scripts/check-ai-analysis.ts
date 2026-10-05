import assert from "node:assert/strict";
import { config } from "dotenv";
import { readFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";
import { createSessionToken, sessionCookieName } from "../lib/auth/token";
import { getGoldAnalysisById, getCurrentGoldAnalysis, claimGeneration, releaseGeneration, saveGoldAnalysis } from "../lib/data/gold-analyses";
import type { GoldWeeklyAnalysis, TechnicalContext } from "../lib/ai/schemas";
import type { GoldAnalysisSnapshot } from "../lib/market-data/types";
import { cachedMarketData } from "../lib/market-data/cache";

config({ path: ".env.development.local", quiet: true }); config({ path: ".env", quiet: true });
const base = process.env.TEST_BASE_URL ?? "http://localhost:3000";
async function main() {
  assert.ok(process.env.DATABASE_URL);
  const client = neon(process.env.DATABASE_URL);
  const fixtureIds: string[] = [];
  const cacheKey = `ai-test:${crypto.randomUUID()}`;
  try {
    const [a] = await client`INSERT INTO users (name, email, password_hash) VALUES ('AI test A', ${`ai-a-${crypto.randomUUID()}@example.invalid`}, 'test-no-login') RETURNING id`;
    fixtureIds.push(String(a.id));
    const [b] = await client`INSERT INTO users (name, email, password_hash) VALUES ('AI test B', ${`ai-b-${crypto.randomUUID()}@example.invalid`}, 'test-no-login') RETURNING id`;
    fixtureIds.push(String(b.id));
    const cookieA = `${sessionCookieName}=${await createSessionToken(String(a.id), "test-no-login")}`;
    const cookieB = `${sessionCookieName}=${await createSessionToken(String(b.id), "test-no-login")}`;
    async function request(url: string, cookie: string, init?: RequestInit) { return fetch(`${base}${url}`, { ...init, headers: { Cookie: cookie, ...init?.headers } }); }
    assert.equal((await fetch(`${base}/api/ai-analysis/current`)).status, 401);
    assert.equal((await request("/api/ai-analysis/current", cookieA)).status, 200);
    assert.equal(await getCurrentGoldAnalysis(String(a.id)), null);
    for (const path of ["/ai-analysis", "/dashboard", "/journal", "/trades", "/calendar", "/reports"]) {
      const response = await request(path, cookieA); assert.equal(response.status, 200, path);
    }
    const configResponse = await request("/api/ai-analysis/generate", cookieA, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: b.id }) });
    assert.equal(configResponse.status, 422);
    const injectedOrigin = await request("/api/ai-analysis/generate", cookieA, { method: "POST", headers: { Origin: "https://invalid.example" }, body: "{}" }); assert.equal(injectedOrigin.status, 403);

    const contextResponse = await request("/api/ai-analysis/generate", cookieA, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ technicalContext: { bias: "bearish" } }) });
    assert.equal(contextResponse.status, 422, "Generation no longer accepts personal technical context");
    const init = { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" };
    const reuse = process.env.AI_TEST_REUSE === "1";
    let reportResponse: Response;
    if (reuse) {
      const artifact = JSON.parse(await readFile(".ai-artifacts/live-analysis.json", "utf8")) as { snapshot: GoldAnalysisSnapshot; analysis: GoldWeeklyAnalysis; context: TechnicalContext };
      const saved = await saveGoldAnalysis(String(a.id), artifact.snapshot, artifact.analysis, { bias: "not_set", resistance: "", support: "", levels: "", notes: "" }, "gpt-6-luna");
      const token = await claimGeneration(String(a.id)); await releaseGeneration(String(a.id), token);
      reportResponse = Response.json({ success: true, data: saved });
      console.info("Reusing a verified live analysis for remaining ownership/browser checks; no paid inference.");
    } else {
      console.info("Testing two simultaneous generation requests; only one should reach OpenAI.");
      reportResponse = Response.json({});
    }
    const pair = await Promise.all([request("/api/ai-analysis/generate", cookieA, init), request("/api/ai-analysis/generate", cookieA, init)]);
    console.info("Generation HTTP results", pair.map(response => response.status));
    for (const response of pair) if (response.status !== 201 && response.status !== 429) console.info("Safe generation response", await response.clone().text());
    assert.deepEqual(pair.map(response => response.status).sort(), reuse ? [429, 429] : [201, 429], "Generation/cooldown statuses");
    if (!reuse) reportResponse = pair.find(response => response.status === 201)!;
    const saved = await reportResponse.json(); const id = String(saved.data.id);
    assert.equal(saved.data.model, "gpt-6-luna");
    assert.equal(saved.data.bullishProbability + saved.data.bearishProbability + saved.data.rangeProbability, 100);
    assert.equal(saved.data.technicalContext.bias, "not_set");
    assert.ok(saved.data.dataSnapshot.gold.latestPrice > 0);
    assert.ok(saved.data.dataSnapshot.consensus == null); assert.equal(saved.data.dataSnapshot.news, null);
    assert.equal(await getGoldAnalysisById(String(b.id), id), null);
    assert.equal((await request(`/api/ai-analysis/${id}`, cookieB)).status, 404);
    const deniedPage = await request(`/ai-analysis?id=${id}`, cookieB);
    assert.ok(deniedPage.status === 404 || (await deniedPage.text()).includes("This page could not be found"), "Cross-user report page renders not-found even if Next.js already streamed 200 headers");
    assert.equal((await request(`/api/ai-analysis/${id}`, cookieB, { method: "PATCH", body: "{}" })).status, 405);
    assert.equal((await request(`/api/ai-analysis/${id}`, cookieB, { method: "DELETE" })).status, 404);
    const reportBefore = await getGoldAnalysisById(String(a.id), id);
    assert.ok(reportBefore);
    for (const path of ["/api/ai-analysis/current", "/api/ai-analysis/history", `/api/ai-analysis/${id}`, "/ai-analysis", "/ai-analysis", `/ai-analysis?id=${id}`]) {
      const response = await request(path, cookieA); assert.equal(response.status, 200, path);
      const body = await response.text(); assert.ok(!body.includes(process.env.OPENAI_API_KEY!)); assert.ok(!body.includes(process.env.FRED_API_KEY!)); assert.ok(!body.includes(process.env.ALPHA_VANTAGE_API_KEY!));
    }
    assert.equal((await request("/api/ai-analysis/generate", cookieA, init)).status, 429, "Refresh respects cooldown");
    const [counts] = await client`SELECT count(*)::int AS count FROM gold_weekly_analyses WHERE user_id = ${a.id}`;
    assert.equal(counts.count, 1);
    const reportAfter = await getGoldAnalysisById(String(a.id), id);
    assert.deepEqual(reportAfter?.dataSnapshot, reportBefore.dataSnapshot);
    // Separate atomic-lease test avoids another paid model request.
    const claims = await Promise.allSettled([claimGeneration(String(b.id)), claimGeneration(String(b.id))]);
    assert.equal(claims.filter(result => result.status === "fulfilled").length, 1);
    const claimed = claims.find(result => result.status === "fulfilled");
    if (claimed?.status === "fulfilled") await releaseGeneration(String(b.id), claimed.value);
    let providerLoads = 0;
    const cachedLoad = () => cachedMarketData(cacheKey, 60, async () => { providerLoads++; return { test: true }; });
    const parallelCache = await Promise.allSettled([cachedLoad(), cachedLoad()]);
    assert.ok(parallelCache.some(result => result.status === "fulfilled"));
    await cachedLoad(); assert.equal(providerLoads, 1);
    console.info(JSON.stringify({ status: "passed", liveModel: saved.data.model, analysisSaved: true, probabilities: saved.data.analysis.probabilities, confidence: saved.data.confidence, userIsolation: "passed", duplicateAndCooldown: "passed", immutableSnapshot: "passed", providerCache: "one load", existingPages: "passed", apiSecrets: "not exposed" }, null, 2));
    if (process.env.AI_TEST_BROWSER === "1") {
      const { checkAiBrowser } = await import("./check-ai-browser");
      await checkAiBrowser(base, cookieA.split("=")[1], id);
    }
  } finally {
    for (const id of fixtureIds) await client`DELETE FROM users WHERE id = ${id}`;
    await client`DELETE FROM market_data_cache WHERE key = ${cacheKey}`;
    console.info("Removed the two temporary AI test accounts and their test report/locks. Shared public-data caches retained.");
  }
}
main().catch(error => { if (error instanceof assert.AssertionError) console.error("Assertion failed:", error.message); console.error("AI live integration test failed. Inspect the test stage and safe server error; no credentials printed."); process.exitCode = 1; });
