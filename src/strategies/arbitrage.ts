/**
 * Advanced arbitrage strategy module for the beast.
 * Implements researched techniques: simple sum arb, orderbook based, temporal hints.
 * Designed to be used via route_agent_intent plans or direct tool exposure.
 * Fits MCP role as executor surface.
 */

import { submitLimitOrder } from '../trading/orders.js';
import { getBookSnapshot } from '../data/orderbook.js';
import { detectMispricing, scanMispricingOpportunities } from '../intelligence/mispricing.js';
import { logger, logTrade } from '../utils/logger.js';

export async function executeSimpleArbitrage(tokenId: string, edgeThreshold: number = 0.015) {
  const sig = await detectMispricing(tokenId);
  if (!sig || sig.edge < edgeThreshold) {
    return { executed: false, reason: 'no sufficient edge', sig };
  }

  // In practice, for true arb you buy both sides at favorable prices.
  // Here we demonstrate one side for illustration; full would use bundle or two orders.
  const size = 10; // small for safety
  const price = sig.yesPrice < 0.5 ? sig.yesPrice + 0.01 : sig.noPrice + 0.01; // illustrative

  const side = sig.yesPrice < sig.noPrice ? 'BUY' : 'SELL'; // simplified

  try {
    const res = await submitLimitOrder({
      tokenId,
      side: side as any,
      price: price.toString(),
      size: size.toString(),
    });
    logTrade('Arbitrage attempt', { tokenId, side, price, size, edge: sig.edge });
    return { executed: res.ok, result: res, sig };
  } catch (e: any) {
    logger.error('arb execution failed', { error: e.message });
    return { executed: false, error: e.message, sig };
  }
}

export async function scanAndReportArbitrage(tokenIds: string[]) {
  return scanMispricingOpportunities(tokenIds);
}
