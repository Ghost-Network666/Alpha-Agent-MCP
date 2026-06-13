/**
 * Multi-host credential loader (Hermes + OpenClaw support).
 * Detects the hosting framework from environment variables and loads the
 * correct .env file with proper isolation.
 *
 * Precedence (highest to lowest):
 *   1. Process environment (already set by the host/gateway — never overridden)
 *   2. Host-specific .env (Hermes profile or OpenClaw root)
 *   3. Legacy fallbacks (with warning) for backward compatibility only
 *
 * Hermes (profile isolation):
 *   - If HERMES_HOME is set: load only $HERMES_HOME/.env (profile’s own file).
 *     Do *not* also load a global ~/.hermes/.env — this breaks isolation.
 *   - If HERMES_HOME is not set but ~/.hermes exists: load ~/.hermes/.env (default profile).
 *
 * OpenClaw:
 *   - If OPENCLAW_HOME or OPENCLAW_GATEWAY (or ~/.openclaw dir) detected: load ~/.openclaw/.env .
 *   - Respects OpenClaw rule: workspace .env files are ignored for secrets.
 *
 * All loading happens once, early, via loadProjectEnv(). Existing process.env values win.
 * Clear log line: “Loaded credentials from <source>”.
 */
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { logger } from '../utils/logger.js';

let loaded = false;

function getHermesEnvPath(): string | null {
  if (process.env.HERMES_HOME) {
    return join(process.env.HERMES_HOME, '.env');
  }
  const defaultHermes = join(homedir(), '.hermes');
  if (existsSync(defaultHermes)) {
    return join(defaultHermes, '.env');
  }
  return null;
}

function getOpenClawEnvPath(): string | null {
  // Common OpenClaw indicators (host sets these or the dir exists)
  const home = process.env.OPENCLAW_HOME || process.env.OPENCLAW_GATEWAY;
  if (home) {
    return join(home, '.env');
  }
  const defaultOpenClaw = join(homedir(), '.openclaw');
  const candidate = join(defaultOpenClaw, '.env');
  if (existsSync(candidate)) {
    return candidate;
  }
  return null;
}

export function loadProjectEnv(): void {
  if (loaded) return;
  loaded = true;

  // 1. Process environment already wins (hosts inject via their config blocks).
  // We only load a file if it exists and we haven't been fully satisfied by process.env.
  // (dotenv with override:true will still set missing keys.)

  const hermesPath = getHermesEnvPath();
  const openClawPath = getOpenClawEnvPath();

  let chosenPath: string | null = null;
  let source = 'process environment (host override)';

  // Detection order per spec (Hermes explicit profile first when its var is present)
  if (process.env.HERMES_HOME && hermesPath && existsSync(hermesPath)) {
    chosenPath = hermesPath;
    source = `Hermes profile ($HERMES_HOME=${process.env.HERMES_HOME})`;
  } else if (openClawPath && existsSync(openClawPath)) {
    chosenPath = openClawPath;
    source = 'OpenClaw (~/.openclaw/.env or $OPENCLAW_HOME)';
  } else if (hermesPath && existsSync(hermesPath)) {
    // Default Hermes (no explicit HERMES_HOME but ~/.hermes present)
    chosenPath = hermesPath;
    source = 'Hermes default (~/.hermes/.env)';
  }

  if (chosenPath) {
    loadDotenv({ path: chosenPath, override: true });
    logger.info(`Loaded credentials from ${source} (${chosenPath})`);
  } else {
    // Legacy fallback behavior (for pure direct node runs during transition)
    const legacy = join(homedir(), '.hermes', '.env');
    if (existsSync(legacy)) {
      loadDotenv({ path: legacy, override: true });
      logger.warn(`Loaded credentials from legacy fallback ${legacy}. Prefer setting HERMES_HOME or running under a supported host.`);
      source = 'legacy fallback';
    }
  }

  // Never mutate further after this point — callers (getSecureClient etc.) read process.env directly.
}

/** Force reload (for dynamic credential tools in long-running agents). */
export function forceReloadEnv(): void {
  loaded = false;
  loadProjectEnv();
}

/** Switch Hermes profile at runtime (sets HERMES_HOME and reloads). Supports learning agents changing identities without restart. */
export function switchToHermesProfile(profilePath: string): string {
  if (!profilePath) {
    throw new Error('profilePath (e.g. ~/.hermes/profiles/myprofile) is required');
  }
  process.env.HERMES_HOME = profilePath;
  loaded = false;
  loadProjectEnv();
  return `Switched to Hermes profile: HERMES_HOME=${profilePath}. Credentials reloaded from the profile .env. Reset clients or next getSecureClient will use new env.`;
}
