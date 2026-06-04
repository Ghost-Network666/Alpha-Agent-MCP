/** Shared farmability snapshot (SDK fetchOrderBook + listMarketRewards + fetchSpreads). */

export type FarmabilitySnapshot = {
  success: boolean;
  tokenId: string;
  rewardsMinSize?: number;
  rewardsMaxSpread?: number;
  currentMid?: number;
  currentSpread?: number;
  spreadVsMaxAllowed?: number;
  costToQualifyUsd?: number;
  approximateBookDepth?: number;
  suggestedNearMidBuy?: number;
  suggestedNearMidSell?: number;
  competitionSignal?: string;
  farmabilityScore: number;
  recommendation: string;
  notes: string;
  error?: string;
};

export async function fetchFarmabilitySnapshot(
  pub: { fetchOrderBook: (a: { tokenId: string }) => Promise<unknown>; listMarketRewards: (a: { conditionId: string }) => Promise<unknown>; fetchSpreads: (a: { tokenIds: string[] }) => Promise<unknown> },
  tokenId: string
): Promise<FarmabilitySnapshot> {
  try {
    const [book, rewards, spreads] = await Promise.all([
      pub.fetchOrderBook({ tokenId }).catch(() => null),
      pub.listMarketRewards({ conditionId: tokenId }).catch(() => null),
      pub.fetchSpreads({ tokenIds: [tokenId] }).catch(() => null),
    ]);

    const program = (rewards as { items?: Array<{ rewardsMinSize?: string; rewardsMaxSpread?: string }> })?.items?.[0];
    const minSize = program ? parseFloat(program.rewardsMinSize || '0') : 0;
    const maxSpread = program ? parseFloat(program.rewardsMaxSpread || '0') : 0;

    const b = book as { bids?: Array<{ price?: string; size?: string }>; asks?: Array<{ price?: string; size?: string }> } | null;
    const bestBid = b?.bids?.[0]?.price ? parseFloat(b.bids[0].price) : null;
    const bestAsk = b?.asks?.[0]?.price ? parseFloat(b.asks[0].price) : null;
    const mid = bestBid != null && bestAsk != null ? (bestBid + bestAsk) / 2 : null;
    const currentSpread = bestBid != null && bestAsk != null ? bestAsk - bestBid : null;

    const spreadMap = spreads as Record<string, { spread?: string }> | null;
    const spreadData = spreadMap?.[tokenId];
    const accurateCurrentSpread = spreadData?.spread
      ? parseFloat(spreadData.spread)
      : currentSpread;

    const spreadVsAllowed =
      accurateCurrentSpread != null && maxSpread ? accurateCurrentSpread / maxSpread : null;
    const costToQualify = minSize && mid ? minSize * mid : null;

    const bidDepth =
      b?.bids?.slice(0, 3).reduce((sum, x) => sum + parseFloat(x.size || '0'), 0) || 0;
    const askDepth =
      b?.asks?.slice(0, 3).reduce((sum, x) => sum + parseFloat(x.size || '0'), 0) || 0;
    const totalDepth = bidDepth + askDepth;

    let suggestedNearMidBuy: number | undefined;
    let suggestedNearMidSell: number | undefined;
    if (mid != null) {
      suggestedNearMidBuy = Number(Math.max(0.001, mid - 0.0008).toFixed(4));
      suggestedNearMidSell = Number(Math.min(0.999, mid + 0.0008).toFixed(4));
    }

    const depthImbalance = totalDepth > 0 ? Math.abs(bidDepth - askDepth) / totalDepth : 1;
    const competitionSignal =
      totalDepth < 300
        ? 'thin-book (verify flow; potential low-comp but check activity)'
        : totalDepth > 8000
          ? 'deep-book (high competition likely; harder for sticky edge)'
          : depthImbalance < 0.5
            ? 'balanced-moderate depth (favorable for active sticky quoting)'
            : 'imbalanced depth (adverse selection risk higher)';

    let farmabilityScore = 0;
    if (minSize > 0 && mid) farmabilityScore += 25;
    if (spreadVsAllowed != null && spreadVsAllowed < 0.7) farmabilityScore += 35;
    if (accurateCurrentSpread != null && accurateCurrentSpread < 0.015) farmabilityScore += 20;
    if (costToQualify != null && costToQualify < 8) farmabilityScore += 15;
    if (totalDepth > 1000) farmabilityScore += 5;
    if (suggestedNearMidBuy && accurateCurrentSpread != null && accurateCurrentSpread < 0.01) farmabilityScore += 5;

    const recommendation =
      farmabilityScore > 75
        ? 'Excellent for maker farming - tight spread, low cost, good eligibility, near-mid quoting feasible'
        : farmabilityScore > 55
          ? 'Good candidate - monitor for active flow and reprice as needed; use near-mid quotes'
          : farmabilityScore > 35
            ? 'Marginal - check for wide spreads or low activity; consider smaller test size or different market'
            : 'Poor right now - wide spread vs allowed, high cost, or low eligibility. Look for better opportunities per exit rules.';

    return {
      success: true,
      tokenId,
      rewardsMinSize: minSize || undefined,
      rewardsMaxSpread: maxSpread || undefined,
      currentMid: mid != null ? Number(mid.toFixed(4)) : undefined,
      currentSpread:
        accurateCurrentSpread != null ? Number(accurateCurrentSpread.toFixed(4)) : undefined,
      spreadVsMaxAllowed:
        spreadVsAllowed != null ? Number(spreadVsAllowed.toFixed(2)) : undefined,
      costToQualifyUsd: costToQualify != null ? Number(costToQualify.toFixed(2)) : undefined,
      approximateBookDepth: Number(totalDepth.toFixed(0)),
      suggestedNearMidBuy,
      suggestedNearMidSell,
      competitionSignal,
      farmabilityScore: Math.min(100, farmabilityScore),
      recommendation,
      notes:
        'SDK-native only. Host LLM interprets; MCP does not call external models. Cross with strategy store + explicit place_* tools.',
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      success: false,
      tokenId,
      farmabilityScore: 0,
      recommendation: 'Unavailable',
      notes: msg,
      error: msg,
    };
  }
}