const URLS = [
  'https://raw.githubusercontent.com/Polymarket/ts-sdk/main/packages/client/README.md',
  'https://raw.githubusercontent.com/Polymarket/ts-sdk/main/README.md',
] as const;

const TTL_MS = Number(process.env.SDK_README_CACHE_TTL_MS ?? 3_600_000);

let cache: { body: string; fetchedAt: string; sourceUrl: string; etag?: string } | null = null;

export async function fetchLiveSdkReadme(): Promise<{
  markdown: string;
  sourceUrl: string;
  fetchedAt: string;
  installedVersion: string;
  fromCache: boolean;
  canonicalUrl: string;
}> {
  const { createRequire } = await import('module');
  const require = createRequire(import.meta.url);
  const installedVersion = String(require('@polymarket/client/package.json').version ?? 'unknown');
  const canonicalUrl = 'https://github.com/Polymarket/ts-sdk/blob/main/README.md';

  if (cache && Date.now() - new Date(cache.fetchedAt).getTime() < TTL_MS) {
    return {
      markdown: cache.body,
      sourceUrl: cache.sourceUrl,
      fetchedAt: cache.fetchedAt,
      installedVersion,
      fromCache: true,
      canonicalUrl,
    };
  }

  let lastErr: unknown;
  for (const url of URLS) {
    try {
      const headers: Record<string, string> = { Accept: 'text/plain' };
      if (cache?.etag) headers['If-None-Match'] = cache.etag;
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(20_000) });
      if (res.status === 304 && cache) {
        return {
          markdown: cache.body,
          sourceUrl: cache.sourceUrl,
          fetchedAt: cache.fetchedAt,
          installedVersion,
          fromCache: true,
          canonicalUrl,
        };
      }
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const body = await res.text();
      cache = {
        body,
        fetchedAt: new Date().toISOString(),
        sourceUrl: url,
        etag: res.headers.get('etag') ?? undefined,
      };
      return {
        markdown: body,
        sourceUrl: url,
        fetchedAt: cache.fetchedAt,
        installedVersion,
        fromCache: false,
        canonicalUrl,
      };
    } catch (e) {
      lastErr = e;
    }
  }

  throw new Error(`SDK README fetch failed: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`);
}