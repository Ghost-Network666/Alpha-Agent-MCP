/**
 * Momentum and reversal signals for beast trading.
 * From research: short-term price action, order flow imbalance, fade overextensions.
 * Uses live book and price data.
 */

import { getBookSnapshot, getMidpoint } from '../data/orderbook.js';
import { logger } from '../utils/logger.js';

export interface MomentumSignal {
  tokenId: string;
  mid: number;
  recentMove: number; // simulated or from history if available
  imbalance: number;
  signal: 'MOMENTUM_UP' | 'MOMENTUM_DOWN' | 'REVERSAL_FADE' | 'NEUTRAL';
  strength: number;
  confidence: number;
  rationale: string;
}

export async function getMomentumSignal(tokenId: string, lookbackMid: number = 0.5): Promise<MomentumSignal> {
  const book = await getBookSnapshot(tokenId);
  const mid = getMidpoint(book).yes;
  const imbalance = book.imbalance || 0;

  const recentMove = mid - lookbackMid; // in real, use recent mids from WS or history

  let signal: MomentumSignal['signal'] = 'NEUTRAL';
  let strength = Math.abs(recentMove) * 10;

  if (Math.abs(recentMove) > 0.03) {
    if (recentMove > 0 && imbalance > 0.6) signal = 'MOMENTUM_UP';
    else if (recentMove < 0 && imbalance < -0.6) signal = 'MOMENTUM_DOWN';
    else signal = 'REVERSAL_FADE';
  }

  const confidence = Math.min(0.9, 0.5 + strength * 0.1);

  return {
    tokenId,
    mid,
    recentMove,
    imbalance,
    signal,
    strength: Math.min(1, strength),
    confidence,
    rationale: `Mid ${mid.toFixed(3)} (move ${recentMove.toFixed(3)}), imbalance ${imbalance.toFixed(2)}. ${signal} at strength ${strength.toFixed(2)}.`,
  };
}
