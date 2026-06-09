export * from './crossmarket.js';
export * from './ensemble.js';
export * from './mispricing.js';
export * from './momentum.js';
export * from './riskkelly.js';

// Stubs for mcp.js imports
export async function computeBayesianPosterior(tokenId: string, prior?: number) {
  return { posterior: prior || 0.5, divergence: 0, divergenceBps: 0, reasoning: "stub", actionHint: "HOLD" };
}
export async function fetchFarmabilitySnapshot(tokenId: string) { return null; }
export async function buildAlphaReport() { return { report: "stub" }; }
export async function fetchRewardCandidates() { return []; }
export async function rankOpportunities() { return []; }
