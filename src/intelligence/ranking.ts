import type { FarmabilitySnapshot } from './farmability.js';
import { computeBayesianPosterior } from './bayesian.js';
import type { RewardCandidate } from './rewards-candidates.js';

export type OpportunityInput = {
  tokenId: string;
  label?: string;
  prior?: number;
  externalSignal?: number;
  signalWeight?: number;
  source?: 'rewards' | 'discovery' | 'manual';
  rewardMeta?: Partial<RewardCandidate>;
  farmability?: FarmabilitySnapshot;
};

export type RankedOpportunity = {
  rank: number;
  tokenId: string;
  label: string;
  compositeScore: number;
  confidence: 'high' | 'medium' | 'low';
  signals: {
    farmabilityScore?: number;
    rewardAttractiveness?: number;
    bayesianDivergenceBps?: number;
    cheapestMinCostUsd?: number;
    competitionSignal?: string;
  };
  recommendation: string;
  nextTools: string[];
};

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function rankOpportunities(
  inputs: OpportunityInput[],
  opts: { goal: string; maxResults?: number } = { goal: 'rewards' }
): RankedOpportunity[] {
  const maxResults = Math.min(Math.max(opts.maxResults ?? 5, 1), 10);
  const goal = opts.goal;

  const scored = inputs.map((inp) => {
    const farm = inp.farmability;
    const reward = inp.rewardMeta;
    let composite = 0;
    const signals: RankedOpportunity['signals'] = {};

    if (reward?.attractiveness != null) {
      signals.rewardAttractiveness = reward.attractiveness;
      composite += Math.min(40, reward.attractiveness * 0.35);
    }
    if (farm?.success && farm.farmabilityScore != null) {
      signals.farmabilityScore = farm.farmabilityScore;
      composite += farm.farmabilityScore * 0.45;
      signals.competitionSignal = farm.competitionSignal;
    }
    if (reward?.cheapestMinCostUsd != null) {
      signals.cheapestMinCostUsd = reward.cheapestMinCostUsd;
      if (reward.cheapestMinCostUsd <= 5) composite += 12;
      else if (reward.cheapestMinCostUsd <= 10) composite += 6;
    }

    if (inp.prior != null && inp.externalSignal != null) {
      const bay = computeBayesianPosterior({
        prior: clamp01(inp.prior),
        signal: clamp01(inp.externalSignal),
        weight: inp.signalWeight ?? 0.4,
      });
      signals.bayesianDivergenceBps = bay.divergenceBps;
      composite += Math.min(25, bay.divergenceBps / 4);
    }

    const confidence: RankedOpportunity['confidence'] =
      composite >= 70 ? 'high' : composite >= 45 ? 'medium' : 'low';

    let recommendation = farm?.recommendation || reward?.whyRecommended || 'Review manually';
    if (goal === 'mispricing' && (signals.bayesianDivergenceBps ?? 0) >= 500) {
      recommendation = 'External signal diverges from platform price — host should validate thesis before sizing';
    }

    const nextTools: string[] = ['get_strategies', 'fetch_market'];
    if (goal === 'rewards') {
      nextTools.push('suggest_qualified_size', 'place_optimized_reward_order');
    } else if (goal === 'weather' || goal === 'discovery') {
      nextTools.push('get_uk_weather_forecast', 'place_limit_order');
    } else {
      nextTools.push('suggest_qualified_size', 'place_limit_order');
    }
    if (farm?.success) nextTools.unshift('get_farmability');

    return {
      tokenId: inp.tokenId,
      label: inp.label || reward?.question || inp.tokenId.slice(0, 12) + '...',
      compositeScore: Number(Math.min(100, composite).toFixed(1)),
      confidence,
      signals,
      recommendation,
      nextTools: [...new Set(nextTools)],
    };
  });

  return scored
    .sort((a, b) => b.compositeScore - a.compositeScore)
    .slice(0, maxResults)
    .map((x, i) => ({ rank: i + 1, ...x }));
}