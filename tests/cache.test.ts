import assert from "node:assert/strict";
import test from "node:test";

process.env.UPSTASH_REDIS_REST_URL = "https://cache.example.test";
process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";

const cache = import("../lib/cache");

test("cache uses POST for large payloads, reads them back, and invalidates keys", async () => {
  const { getCached, setCached, deleteCached } = await cache;
  const originalFetch = globalThis.fetch;
  const values = new Map<string, string>();
  const calls: string[][] = [];
  globalThis.fetch = async (input, init) => {
    assert.equal(input, "https://cache.example.test");
    assert.equal(init?.method, "POST");
    assert.equal(init?.cache, "no-store");
    const parts = JSON.parse(String(init?.body)) as string[];
    calls.push(parts);
    let result: string | number | null = null;
    if (parts[0] === "set") { values.set(parts[1], parts[2]); result = "OK"; }
    if (parts[0] === "get") result = values.get(parts[1]) ?? null;
    if (parts[0] === "del") result = parts.slice(1).reduce((count, key) => count + Number(values.delete(key)), 0);
    return Response.json({ result });
  };
  try {
    const value = { trades: "x".repeat(50_000) };
    await setCached("tradezilla:test", value, 45);
    assert.deepEqual(await getCached("tradezilla:test"), value);
    assert.deepEqual(calls[0].slice(0, 2), ["set", "tradezilla:test"]);
    assert.deepEqual(calls[0].slice(3), ["EX", "45"]);
    await deleteCached("tradezilla:test", "tradezilla:test");
    assert.deepEqual(calls[2], ["del", "tradezilla:test"]);
    assert.equal(await getCached("tradezilla:test"), null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("cache falls back on a Redis error response", async () => {
  const { getCached } = await cache;
  const originalFetch = globalThis.fetch;
  const originalWarn = console.warn;
  globalThis.fetch = async () => Response.json({ error: "test error" });
  console.warn = () => {};
  try {
    assert.equal(await getCached("tradezilla:test"), null);
  } finally {
    globalThis.fetch = originalFetch;
    console.warn = originalWarn;
  }
});
