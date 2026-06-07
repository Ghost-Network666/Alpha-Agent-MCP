/**
 * Ensemble probability and edge scoring for beast mode.
 * Combines multiple signals (bayesian, farmability, mispricing, momentum, ranking) with confidence.
 * Outside-the-box: fuses intelligence modules for superior edge estimation.
 * Kelly helper included.
 */

import { computeBayesianPosterior } from './bayesian.js';
import { fetchFarmabilitySnapshot } from './farmability.js';
import { rankOpportunities } from './ranking.js';
import { getMomentumSignal } from './momentum.js';
import { detectMispricing } from './mispricing.js';
import { logger } from '../utils/logger.js';

export interface EnsembleEdge {
  tokenId: string;
  combinedProbability: number;
  marketPrice: number;
  edge: number;
  confidence: number;
  kellyFraction: number;
  signals: string[];
  rationale: string;
}

export async function computeEnsembleEdge(tokenId: string, prior: number = 0.5, bankroll: number = 10000): Promise<EnsembleEdge | null> {
  try {
    const [bayes, farm, momentum, misprice] = await Promise.all([
      computeBayesianPosterior(tokenId, prior).catch(() => ({ posterior: prior })),
      fetchFarmabilitySnapshot(tokenId).catch(() => null),
      getMomentumSignal(tokenId).catch(() => null),
      detectMispricing(tokenId).catch(() => null),
    ]);

    const probs: number[] = [bayes.posterior];
    const signals: string[] = ['bayesian'];

    if (farm) {
      // boost prob if high farmability/rewards
      if (farm.currentBoost > 0.1) probs.push(0.6);
      signals.push('farmability');
    }

    if (momentum) {
      if (momentum.signal.includes('MOMENTUM')) probs.push(momentum.mid + (momentum.recentMove * 0.2));
      signals.push('momentum');
    }

    if (misprice && misprice.edge > 0) {
      probs.push(0.5 + misprice.edge * 2); // arb implies mispricing in prob
      signals.push('mispricing');
    }

    const combined = probs.reduce((a, b) => a + b, 0) / probs.length;
    const marketPrice = misprice?.yesPrice || 0.5;
    const edge = combined - marketPrice;

    const confidence = Math.min(0.95, 0.5 + (probs.length - 1) * 0.15 + Math.abs(edge) * 2);

    // Fractional Kelly (conservative)
    const kelly = edge > 0 ? Math.min(0.25, edge * confidence * 0.5) : 0;

    return {
      tokenId,
      combinedProbability: combined,
      marketPrice,
      edge,
      confidence,
      kellyFraction: kelly,
      signals,
      rationale: `Ensemble from ${signals.join('+')}. Prob ${combined.toFixed(3)} vs market ${marketPrice.toFixed(3)} (edge ${(edge*100).toFixed(1)}%). Kelly ${ (kelly*100).toFixed(1)}% of BR. Conf ${ (confidence*100).toFixed(0)}%.`,
    };
  } catch (e: any) {
    logger.warn('ensemble edge failed', { tokenId, error: e.message });
    return null;
  }
}
