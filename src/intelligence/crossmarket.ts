/**
 * Cross-market correlation and combinatorial arb signals.
 */
import { getMarket } from '../data/markets.js';
import { getBookSnapshot } from '../data/orderbook.js';
import { logger } from '../utils/logger.js';

export interface CrossMarketSignal {
  primaryTokenId: string;
  relatedTokenIds: string[];
  correlationHint: number;
  comboEdge: number;
  recommendation: string;
  rationale: string;
}

export async function getCrossMarketSignal(primaryTokenId: string, related: string[]): Promise<CrossMarketSignal> {
  const primaryBook = await getBookSnapshot(primaryTokenId);
  const ask = Number(primaryBook.asks?.[0]?.price || 0.5);
  const bid = Number(primaryBook.bids?.[0]?.price || 0.5);
  const primaryMid = (ask + bid) / 2;

  let totalRelatedMid = 0;
  let count = 0;
  for (const rel of related.slice(0, 3)) {
    try {
      const b = await getBookSnapshot(rel);
      const rAsk = Number(b.asks?.[0]?.price || 0.5);
      const rBid = Number(b.bids?.[0]?.price || 0.5);
      totalRelatedMid += (rAsk + rBid) / 2;
      count++;
    } catch {}
  }
  const avgRelated = count ? totalRelatedMid / count : primaryMid;
  const diff = primaryMid - avgRelated;
  const comboEdge = Math.abs(diff) * 0.8;

  const correlationHint = Math.max(-0.9, Math.min(0.9, 1 - Math.abs(diff) * 5));

  return {
    primaryTokenId,
    relatedTokenIds: related,
    correlationHint,
    comboEdge,
    recommendation: comboEdge > 0.02 ? 'CONSIDER_HEDGE_OR_ARB_BUNDLE' : 'NO_STRONG_CROSS_EDGE',
    rationale: `Primary mid ${primaryMid.toFixed(3)} vs related avg ${avgRelated.toFixed(3)} (diff ${diff.toFixed(3)}).`,
  };
}
