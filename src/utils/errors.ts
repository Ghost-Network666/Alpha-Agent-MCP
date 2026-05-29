import {
  ListMarketsError,
  ListEventsError,
  FetchMarketError,
  FetchOrderBookError,
  FetchPriceError,
  PlaceLimitOrderError,
  PlaceMarketOrderError,
  CancelOrderError,
  ListOpenOrdersError,
  ListPositionsError,
  ListActivityError,
} from '@polymarket/client';
import { logger, logError } from './logger.js';

export function isSdkError(error: unknown): boolean {
  return (
    ListMarketsError.isError(error) ||
    ListEventsError.isError(error) ||
    FetchMarketError.isError(error) ||
    FetchOrderBookError.isError(error) ||
    FetchPriceError.isError(error) ||
    PlaceLimitOrderError.isError(error) ||
    PlaceMarketOrderError.isError(error) ||
    CancelOrderError.isError(error) ||
    ListOpenOrdersError.isError(error) ||
    ListPositionsError.isError(error) ||
    ListActivityError.isError(error)
  );
}

export function handleSdkError(error: unknown, context: string): never | void {
  if (isSdkError(error)) {
    const e = error as any;
    if (e?.name === 'RateLimitError') {
      logger.warn(`Rate limited in ${context}. Backing off...`, { context });
    } else if (e?.name === 'RequestRejectedError') {
      logger.error(`Request rejected in ${context}: ${e.message}`, { context, code: e.code });
    } else {
      logError(`SDK error in ${context}`, error);
    }
    throw error;
  }
  logError(`Unexpected error in ${context}`, error);
  throw error;
}

/**
 * Wrap an SDK call with standardized error handling + logging.
 */
export async function withErrorHandling<T>(
  fn: () => Promise<T>,
  context: string
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    handleSdkError(error, context);
    throw error; // unreachable but satisfies TS
  }
}
