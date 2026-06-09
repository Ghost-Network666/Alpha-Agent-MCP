export interface RiskKellySignal { fraction: number; }
export async function computeRiskKelly(tokenId: string, edge?: number, bankroll?: number): Promise<number> {
  return Math.max(0.01, Math.min(0.25, (edge || 0.05) * 2));
}
export async function computeKellyFraction(tokenId: string, edge: number, bankroll: number = 10000): Promise<number> {
  return Math.max(0.01, Math.min(0.25, edge * 2));
}
