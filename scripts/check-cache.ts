import { randomUUID } from "node:crypto";
import { config } from "dotenv";

async function main() {
  const envFile = process.env.NODE_ENV === "production" ? ".env.production" : ".env.development.local";
  config({ path: envFile, quiet: true });
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    throw new Error(`Redis credentials are missing from ${envFile}`);
  }

  const { getCached, setCached, deleteCached } = await import("../lib/cache");
  const key = `tradezilla:cache-check:${randomUUID()}`;
  const value = { marker: randomUUID(), payload: "x".repeat(50_000) };
  try {
    await setCached(key, value, 45);
    const cached = await getCached<typeof value>(key);
    if (cached?.marker !== value.marker || cached.payload !== value.payload) {
      throw new Error("Redis SET/GET round trip failed");
    }
    console.log("Redis SET/GET of a 50 KB value: passed");
  } finally {
    await deleteCached(key);
  }
  if (await getCached(key) !== null) throw new Error("Redis invalidation failed");
  console.log("Redis DEL invalidation: passed");
}

main().catch(error => { console.error(error instanceof Error ? error.message : "Cache check failed"); process.exitCode = 1; });
