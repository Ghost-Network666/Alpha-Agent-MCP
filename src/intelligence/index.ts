export * from './crossmarket.js';
export * from './ensemble.js';
export * from './mispricing.js';
export * from './momentum.js';
export * from './riskkelly.js';

// Real implementations (barrel for mcp.ts and consumers; direct imports in alpha-report etc. also work).
// This fixes the list_active_maker_reward_markets (and alpha) path that was hitting stubs returning []
// instead of {candidates, note}, which produced "Cannot read properties of undefined (reading 'map')".
export * from './alpha-report.js';
export * from './rewards-candidates.js';
export * from './farmability.js';
export * from './ranking.js';

// Stubs only for anything not yet implemented in the above modules (keep surface stable).
export async function computeBayesianPosterior(tokenId: string, prior?: number) {
  return { posterior: prior || 0.5, divergence: 0, divergenceBps: 0, reasoning: "stub", actionHint: "HOLD" };
}
