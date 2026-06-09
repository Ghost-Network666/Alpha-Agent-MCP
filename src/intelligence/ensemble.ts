export interface EnsembleEdge {
  posterior: number;
  divergence: number;
  divergenceBps: number;
  reasoning: string;
  actionHint: string;
}

export async function computeEnsembleEdge(tokenId: string, prior: number = 0.5): Promise<EnsembleEdge | null> {
  return {
    posterior: prior,
    divergence: 0,
    divergenceBps: 0,
    reasoning: "stub",
    actionHint: "HOLD",
  };
}
