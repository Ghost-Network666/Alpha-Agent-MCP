import fs from 'fs/promises';
import path from 'path';

const DEFAULT_PATH = path.join(process.cwd(), 'logs', 'agent-strategy.json');

export function strategyStorePath(): string {
  return process.env.MCP_STRATEGY_PATH || DEFAULT_PATH;
}

export async function loadStrategyFile(): Promise<Record<string, unknown>> {
  const file = strategyStorePath();
  try {
    const raw = await fs.readFile(file, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export async function saveStrategyFile(data: Record<string, unknown>): Promise<void> {
  const file = strategyStorePath();
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(data, null, 2), 'utf8');
}