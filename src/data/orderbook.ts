import type { OrderBook, OrderSide } from '@polymarket/client';
import { getPublicClient } from '../config/client.js';
import { collectAll } from '../utils/pagination.js';
import { withErrorHandling } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

const client = () => getPublicClient();

export interface BookSnapshot extends OrderBook {
  spread: string;
  midpoint: string;
}

export async function getOrderBook(tokenId: string): Promise<OrderBook> {
  logger.debug('Fetching order book', { tokenId: tokenId.slice(0, 10) + '...' });
  return withErrorHandling(
    () => client().fetchOrderBook({ tokenId }),
    'data.getOrderBook'
  );
}

export async function getOrderBooks(tokenIds: string[]): Promise<OrderBook[]> {
  return withErrorHandling(
    () => client().fetchOrderBooks(tokenIds.map((t) => ({ tokenId: t }))),
    'data.getOrderBooks'
  );
}

export async function getBookSnapshot(tokenId: string): Promise<BookSnapshot> {
  const [book, spread, midpoint] = await Promise.all([
    getOrderBook(tokenId),
    getSpread(tokenId),
    getMidpoint(tokenId),
  ]);
  return { ...book, spread, midpoint };
}

export async function getPrice(tokenId: string, side: OrderSide): Promise<string> {
  return withErrorHandling(() => client().fetchPrice({ tokenId, side }), 'data.getPrice');
}

export async function getMidpoint(tokenId: string): Promise<string> {
  return withErrorHandling(() => client().fetchMidpoint({ tokenId }), 'data.getMidpoint');
}

export async function getSpread(tokenId: string): Promise<string> {
  return withErrorHandling(() => client().fetchSpread({ tokenId }), 'data.getSpread');
}

export async function getLastTradePrice(tokenId: string): Promise<string> {
  const res: any = await withErrorHandling(() => client().fetchLastTradePrice({ tokenId }), 'data.getLastTradePrice');
  return typeof res === 'string' ? res : (res?.price ?? '0.5');
}

export async function getPriceHistory(tokenId: string, interval: any = '1h') {
  return withErrorHandling(
    () => client().fetchPriceHistory({ tokenId, interval }),
    'data.getPriceHistory'
  );
}

/**
 * List trades (public recent or for account if using secure client + listAccountTrades).
 */
export async function getRecentTrades(params: any) {
  const paginator = client().listTrades(params);
  return collectAll(paginator as any, { maxPages: 20 });
}
