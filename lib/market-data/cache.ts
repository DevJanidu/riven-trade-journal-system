import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { marketDataCache } from "@/lib/db/schema";
import { ProviderError } from "./http";

export async function cachedMarketData<T>(key: string, ttlSeconds: number, load: () => Promise<T>): Promise<T> {
  const db = getDb();
  const [cached] = await db.select().from(marketDataCache).where(eq(marketDataCache.key, key)).limit(1);
  if (cached && cached.expiresAt > new Date()) {
    if (cached.payload !== null) return cached.payload as T;
    throw new ProviderError("Market data cache", "unavailable");
  }
  const token = randomUUID();
  // Atomic lease across users and serverless instances prevents provider stampedes.
  const claimed = await db.execute(sql`INSERT INTO market_data_cache (key, payload, expires_at, lock_token, locked_until)
    VALUES (${key}, NULL, now(), ${token}::uuid, now() + interval '3 minutes')
    ON CONFLICT (key) DO UPDATE SET lock_token = EXCLUDED.lock_token, locked_until = EXCLUDED.locked_until
    WHERE market_data_cache.expires_at <= now() AND market_data_cache.locked_until <= now()
    RETURNING key`);
  if (!claimed.rows.length) throw new ProviderError("Market data is being refreshed", "unavailable");
  try {
    const value = await load();
    await db.update(marketDataCache).set({ payload: value, expiresAt: new Date(Date.now() + ttlSeconds * 1000), lockedUntil: new Date(0) }).where(and(eq(marketDataCache.key, key), eq(marketDataCache.lockToken, token)));
    return value;
  } catch (error) {
    // Negative cache avoids repeated quota failures. Never silently substitute old data.
    await db.update(marketDataCache).set({ payload: null, expiresAt: new Date(Date.now() + 15 * 60000), lockedUntil: new Date(0) }).where(and(eq(marketDataCache.key, key), eq(marketDataCache.lockToken, token)));
    throw error;
  }
}
