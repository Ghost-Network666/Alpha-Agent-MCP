import type { Market, Event } from '@polymarket/client';
import { getPublicClient } from '../config/client.js';
import { collectAll, firstPage } from '../utils/pagination.js';
import { withErrorHandling } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

const client = () => getPublicClient();

/**
 * List active (or all) markets with full pagination support.
 * Uses the SDK client's built-in paginator.
 */
export async function listAllMarkets(params: any = { closed: false, pageSize: 100 }): Promise<Market[]> {
  logger.debug('Fetching markets', params);
  const paginator = client().listMarkets(params);
  return collectAll(paginator, { maxPages: 200 });
}

export async function getFirstMarketsPage(params?: any) {
  const paginator = client().listMarkets({ closed: false, pageSize: 20, ...params });
  return firstPage(paginator);
}

/**
 * Fetch single market by id, slug, or url.
 */
export async function getMarket(params: { id?: string; slug?: string; url?: string }): Promise<Market> {
  return withErrorHandling(
    () => client().fetchMarket(params as any),
    'data.getMarket'
  );
}

/**
 * List events (tournaments, multi-market groups).
 */
export async function listAllEvents(params: any = { pageSize: 50 }): Promise<Event[]> {
  const paginator = client().listEvents(params);
  return collectAll(paginator, { maxPages: 100 });
}

export async function getEvent(params: { id?: string; slug?: string; url?: string }): Promise<Event> {
  return withErrorHandling(() => client().fetchEvent(params as any), 'data.getEvent');
}

/**
 * Full-text search across markets/events/profiles.
 */
export async function searchPolymarket(q: string, pageSize = 20) {
  const paginator: any = client().search({ q, pageSize });
  return collectAll(paginator, { maxPages: 10 });
}

/**
 * Convenience: find a market by slug (exact or fuzzy via search).
 */
export async function findMarketBySlug(slug: string): Promise<Market | null> {
  try {
    return await getMarket({ slug });
  } catch {
    const results = await searchPolymarket(slug, 5);
    const match = (results as any[]).find((r: any) => r?.markets?.[0]?.slug === slug || r?.slug === slug);
    if (match?.markets?.[0]) return match.markets[0] as Market;
    return null;
  }
}
