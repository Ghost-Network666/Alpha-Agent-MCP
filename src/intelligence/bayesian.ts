/** Precision-weighted Bayesian update (deterministic; host LLM supplies signals). */
export function computeBayesianPosterior(params: {
  prior: number;
  signal: number;
  weight?: number;
}): { posterior: number; divergence: number; divergenceBps: number; reasoning: string; actionHint: string } {
  const { prior, signal, weight = 0.5 } = params;
  const w = Math.max(0, Math.min(1, weight));
  const posterior = (1 - w) * prior + w * signal;
  const divergence = Math.abs(posterior - prior);
  const divergenceBps = Math.round(divergence * 10000);
  let actionHint = 'No clear edge.';
  if (divergence >= 0.08) actionHint = 'Strong edge — consider position.';
  else if (divergence >= 0.05) actionHint = 'Moderate edge — investigate further.';
  return {
    posterior: Number(posterior.toFixed(4)),
    divergence: Number(divergence.toFixed(4)),
    divergenceBps,
    reasoning: `Bayesian update with weight=${w}. Divergence from prior: ${(divergence * 100).toFixed(1)}pp`,
    actionHint,
  };
}