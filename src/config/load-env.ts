/**
 * Load ~/.hermes/.env — the Hermes "root" .env (permanent rule).
 * Single source of truth for all credentials: Hermes gateway, profiles, Grok, and Alpha-MCP.
 * Not Alpha-MCP-TS/.env, not profile .env files, not mcp_servers.*.env in config.yaml.
 */
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { config as loadDotenv } from 'dotenv';

let loaded = false;

/** `~/.hermes/.env` or `$HERMES_HOME/.env`. */
export function getHermesEnvPath(): string {
  const home = process.env.HERMES_HOME || join(homedir(), '.hermes');
  return join(home, '.env');
}

/** Load Hermes `.env` once; overrides stale host placeholders (e.g. unresolved ${EOA_PRIVATE_KEY}). */
export function loadProjectEnv(): void {
  if (loaded) return;
  loaded = true;
  const envPath = getHermesEnvPath();
  if (!existsSync(envPath)) return;
  loadDotenv({ path: envPath, override: true });
}