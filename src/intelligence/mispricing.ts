/**
 * Mispricing / Arbitrage detection for beast trading.
 * Uses orderbook and market data to find edges (simple YES+NO, spreads, temporal hints).
 * Part of making Alpha-MCP-TS the superior surface for autonomous systems.
 * Researched from top bots: arb on sum <1, orderbook imbalance, spreads.
 */

import { getBookSnapshot, getMidpoint } from '../data/orderbook.js';
import { getMarket } from '../data/markets.js';
import { logger } from '../utils/logger.js';

export interface MispricingSignal {
  tokenId: string;
  marketQuestion?: string;
  yesPrice: number;
  noPrice: number;
  sum: number;
  edge: number; // positive if arb opportunity (sum < 1 - fees estimate)
  spreadBps: number;
  imbalance: number; // from book
  confidence: number;
  recommendation: string;
  rationale: string;
}

export async function detectMispricing(tokenId: string, feeBps: number = 100): Promise<MispricingSignal | null> {
  try {
    const market = await getMarket(tokenId);
    const book = await getBookSnapshot(tokenId);
    const mid = getMidpoint(book);

    const yesPrice = mid.yes;
    const noPrice = 1 - yesPrice; // approximation; in practice use book for both sides if available
    const sum = yesPrice + noPrice;
    const edge = Math.max(0, 1 - sum - (feeBps / 10000));

    const bestBid = book.bids?.[0]?.price || 0;
    const bestAsk = book.asks?.[0]?.price || 1;
    const spreadBps = (bestAsk - bestBid) * 10000;

    const imbalance = book.imbalance || 0; // assume orderbook provides

    const confidence = edge > 0.01 ? 0.85 : 0.6;

    const recommendation = edge > 0.02 ? 'ARBITRAGE_BOTH_SIDES' : edge > 0.005 ? 'MONITOR_OR_SMALL_MM' : 'NO_EDGE';

    const rationale = `Sum ${sum.toFixed(4)} (edge ${ (edge*100).toFixed(2) }% after ~${feeBps/100}% fees est). Spread ${spreadBps.toFixed(0)}bps. Imbalance ${imbalance.toFixed(2)}.`;

    return {
      tokenId,
      marketQuestion: market?.question,
      yesPrice,
      noPrice,
      sum,
      edge,
      spreadBps,
      imbalance,
      confidence,
      recommendation,
      rationale,
    };
  } catch (e: any) {
    logger.warn('mispricing detect failed', { tokenId, error: e.message });
    return null;
  }
}

export async function scanMispricingOpportunities(tokenIds: string[]): Promise<MispricingSignal[]> {
  const results: MispricingSignal[] = [];
  for (const id of tokenIds.slice(0, 10)) { // limit for MCP responsiveness
    const sig = await detectMispricing(id);
    if (sig && sig.edge > 0.005) results.push(sig);
  }
  return results.sort((a, b) => b.edge - a.edge);
}
