const cacheUrl = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, "");
const cacheToken = process.env.UPSTASH_REDIS_REST_TOKEN;

async function command<T>(parts: string[]): Promise<T | null> {
  if (!cacheUrl || !cacheToken) return null;
  try {
    const response = await fetch(cacheUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${cacheToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(parts),
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) {
      console.warn(`Redis cache ${parts[0]} failed with HTTP ${response.status}`);
      return null;
    }
    const body = await response.json() as { result?: T; error?: string };
    if (body.error) {
      console.warn(`Redis cache ${parts[0]} returned an error`);
      return null;
    }
    return body.result ?? null;
  } catch (error) {
    console.warn(`Redis cache ${parts[0]} failed`, error instanceof Error ? error.message : "unknown error");
    return null;
  }
}

export async function getCached<T>(key: string): Promise<T | null> {
  const value = await command<string>(["get", key]);
  if (value === null) return null;
  try { return JSON.parse(value) as T; } catch { return null; }
}

export async function setCached<T>(key: string, value: T, ttlSeconds = 60) {
  await command(["set", key, JSON.stringify(value), "EX", String(ttlSeconds)]);
}

export async function deleteCached(...keys: string[]) {
  if (keys.length) await command(["del", ...new Set(keys)]);
}
