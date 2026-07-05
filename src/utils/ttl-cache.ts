/**
 * Short-lived response cache + per-tool circuit breaker for the MCP dispatcher.
 *
 * Caching is opt-in per call site (see withCache below) — nothing is cached
 * unless a call site explicitly wraps itself with a TTL. Trading, balance,
 * and position calls must never be wrapped with this.
 *
 * The circuit breaker is applied globally per tool name (see mcp.ts
 * callWithFormat / dispatcher catch) and requires no opt-in: it just needs
 * outcomes recorded via recordOutcome().
 */

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

function makeKey(toolName: string, keyArgs: unknown): string {
  return `${toolName}:${JSON.stringify(keyArgs ?? {})}`;
}

export function getCached<T>(toolName: string, keyArgs: unknown): T | undefined {
  const key = makeKey(toolName, keyArgs);
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return undefined;
  }
  return entry.value as T;
}

export function setCached(toolName: string, keyArgs: unknown, value: unknown, ttlMs: number): void {
  if (ttlMs <= 0) return;
  cache.set(makeKey(toolName, keyArgs), { value, expiresAt: Date.now() + ttlMs });
}

/**
 * Wraps a read-only fetch with a short-lived cache. Callers pick their own
 * TTL: ~2s for fast-moving data (order book, midpoint, spread), 30-60s for
 * slower-moving metadata (market/event/tag listings). Never wrap
 * trading, balance, or position calls with this — those must always hit
 * the live SDK.
 */
export async function withCache<T>(
  toolName: string,
  keyArgs: unknown,
  ttlMs: number,
  fn: () => Promise<T>
): Promise<T> {
  const cached = getCached<T>(toolName, keyArgs);
  if (cached !== undefined) return cached;
  const value = await fn();
  setCached(toolName, keyArgs, value, ttlMs);
  return value;
}

// ---- Circuit breaker -------------------------------------------------------

const WINDOW_MS = 60_000;
const MIN_SAMPLES = 5;
const FAILURE_THRESHOLD = 0.5;

interface Sample {
  at: number;
  ok: boolean;
}

const samples = new Map<string, Sample[]>();

function pruneWindow(list: Sample[]): Sample[] {
  const cutoff = Date.now() - WINDOW_MS;
  return list.filter((s) => s.at >= cutoff);
}

/** Records a tool call outcome for circuit-breaker accounting. */
export function recordOutcome(toolName: string, ok: boolean): void {
  const list = pruneWindow(samples.get(toolName) ?? []);
  list.push({ at: Date.now(), ok });
  samples.set(toolName, list);
}

/** True once a tool has failed more than 50% of calls in the trailing 60s (min 5 samples). */
export function isCircuitOpen(toolName: string): boolean {
  const list = pruneWindow(samples.get(toolName) ?? []);
  samples.set(toolName, list);
  if (list.length < MIN_SAMPLES) return false;
  const failures = list.filter((s) => !s.ok).length;
  return failures / list.length > FAILURE_THRESHOLD;
}

export function circuitBreakerResponse(toolName: string) {
  return {
    isError: true,
    content: [{
      type: 'text' as const,
      text: JSON.stringify({
        success: false,
        error: 'SERVICE_DEGRADED',
        message: `${toolName} has failed more than 50% of calls in the last 60s. Temporarily short-circuiting to avoid hammering a degraded dependency — wait and retry shortly.`,
      }, null, 2),
    }],
  };
}
