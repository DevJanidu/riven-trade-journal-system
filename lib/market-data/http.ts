export class ProviderError extends Error {
  constructor(public readonly provider: string, public readonly kind: "configuration" | "rate_limit" | "unavailable" | "invalid") {
    super(`${provider}: ${kind.replaceAll("_", " ")}`);
  }
}
export async function fetchProviderJson(url: URL, provider: string, fetcher: typeof fetch = fetch): Promise<unknown> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetcher(url, { cache: "no-store", signal: AbortSignal.timeout(15000) });
      if (response.status === 429) throw new ProviderError(provider, "rate_limit");
      if (response.status >= 500 && attempt === 0) continue;
      if (!response.ok) throw new ProviderError(provider, response.status >= 500 ? "unavailable" : "invalid");
      try { return await response.json(); } catch { throw new ProviderError(provider, "invalid"); }
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      if (attempt === 1) throw new ProviderError(provider, "unavailable");
    }
  }
  throw new ProviderError(provider, "unavailable");
}
