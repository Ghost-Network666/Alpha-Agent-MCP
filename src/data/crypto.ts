/** Public crypto spot reference (no API key) — for mispricing / externalSignals. */

const CACHE_MS = 120_000;
const cache = new Map<string, { usd: number; at: number }>();

export async function fetchCryptoSpotUsd(
  symbols: string[]
): Promise<Record<string, { usd: number; symbol: string; provider: string }>> {
  const ids = [...new Set(symbols.map((s) => s.toLowerCase().trim()).filter(Boolean))];
  const out: Record<string, { usd: number; symbol: string; provider: string }> = {};
  const missing: string[] = [];

  for (const id of ids) {
    const c = cache.get(id);
    if (c && Date.now() - c.at < CACHE_MS) {
      out[id] = { usd: c.usd, symbol: id, provider: 'coingecko-cache' };
    } else {
      missing.push(id);
    }
  }

  if (!missing.length) return out;

  const q = missing.join(',');
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(q)}&vs_currencies=usd`;
  const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
  if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
  const data = (await res.json()) as Record<string, { usd?: number }>;

  for (const id of missing) {
    const usd = data[id]?.usd;
    if (usd != null) {
      cache.set(id, { usd, at: Date.now() });
      out[id] = { usd, symbol: id, provider: 'coingecko' };
    }
  }

  return out;
}