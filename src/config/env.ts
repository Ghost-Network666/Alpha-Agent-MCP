import 'dotenv/config';
import { z } from 'zod';

/** Base schema — auth fields are optional so public/read-only commands work with zero config. */
const BaseEnvSchema = z.object({
  PRIVATE_KEY: z.string().regex(/^0x[0-9a-fA-F]{64}$/, 'PRIVATE_KEY must be 0x + 64 hex chars').optional(),
  WALLET_ADDRESS: z.string().regex(/^0x[0-9a-fA-F]{40}$/, 'WALLET_ADDRESS must be valid EVM address').optional(),
  POLYGON_RPC_URL: z.string().url().optional(),
  BUILDER_API_KEY: z.string().optional(),
  BUILDER_SECRET: z.string().optional(),
  BUILDER_PASSPHRASE: z.string().optional(),
  RELAYER_API_KEY: z.string().optional(),
  RELAYER_API_KEY_ADDRESS: z.string().optional(),
  DEFAULT_MARKET_SLUG: z.string().optional(),
  DEFAULT_TOKEN_ID: z.string().optional(),
  QUOTE_SPREAD_BPS: z.coerce.number().min(1).max(5000).default(50),
  QUOTE_SIZE_USDC: z.coerce.number().positive().default(5),
  MAX_POSITION_USDC: z.coerce.number().positive().default(500),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  LOG_FILE: z.string().default('logs/polymarket.log'),
});

export type Env = z.infer<typeof BaseEnvSchema>;

/** Strict schema used only for authenticated trading commands. */
const AuthEnvSchema = BaseEnvSchema.extend({
  PRIVATE_KEY: z.string().regex(/^0x[0-9a-fA-F]{64}$/, 'PRIVATE_KEY must be 0x + 64 hex chars'),
  WALLET_ADDRESS: z.string().regex(/^0x[0-9a-fA-F]{40}$/, 'WALLET_ADDRESS must be valid EVM address'),
});

export type AuthEnv = z.infer<typeof AuthEnvSchema>;

let cachedEnv: Env | null = null;

/**
 * Returns the (lenient) environment.
 * Public commands (discover, market, help) can call this safely with no .env file.
 */
export function getEnv(): Env {
  if (cachedEnv) return cachedEnv;
  const parsed = BaseEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    // For the lenient path we still want to surface problems with the optional numeric fields etc.
    console.warn('⚠️  Some environment values are invalid (using defaults where possible):');
    console.warn(parsed.error.flatten().fieldErrors);
  }
  cachedEnv = parsed.success ? parsed.data : (BaseEnvSchema.parse({}) as Env);
  return cachedEnv;
}

/**
 * Enforces that a full authenticated environment is present.
 * Call this at the start of any trading / secure command (maker, account, positions, setup, cancel-all, etc).
 * On failure:
 *   - In CLI: prints a clear message and exits (good UX).
 *   - In MCP server: throws a typed error so the MCP tool wrapper can return { isError: true } without killing the stdio server.
 */
export function requireAuthEnv(): AuthEnv {
  const parsed = AuthEnvSchema.safeParse(process.env);
  const isMcp = process.argv[1]?.includes('mcp') || process.env.MCP_MODE === '1';

  // For MCP mode (agent use), also require Builder keys for proper attribution/rewards/higher limits
  if (isMcp) {
    const builderKeysPresent =
      !!process.env.BUILDER_API_KEY &&
      !!process.env.BUILDER_SECRET &&
      !!process.env.BUILDER_PASSPHRASE;

    if (parsed.success && builderKeysPresent) {
      cachedEnv = parsed.data;
      return parsed.data;
    }

    // Build detailed error
    const errors = parsed.success ? {} : parsed.error.flatten().fieldErrors;
    if (!builderKeysPresent) {
      if (!errors.BUILDER_API_KEY) errors.BUILDER_API_KEY = [];
      errors.BUILDER_API_KEY.push('BUILDER_API_KEY is required for this builder');
      if (!errors.BUILDER_SECRET) errors.BUILDER_SECRET = [];
      errors.BUILDER_SECRET.push('BUILDER_SECRET is required for this builder');
      if (!errors.BUILDER_PASSPHRASE) errors.BUILDER_PASSPHRASE = [];
      errors.BUILDER_PASSPHRASE.push('BUILDER_PASSPHRASE is required for this builder');
    }

    const msg = `Authentication required for Polymarket MCP (Builder mode). Missing/invalid: PRIVATE_KEY + WALLET_ADDRESS (or EOA_PRIVATE_KEY + DEPOSIT_WALLET_ADDRESS) + BUILDER_API_KEY + BUILDER_SECRET + BUILDER_PASSPHRASE. Errors: ${JSON.stringify(errors)}`;
    throw new Error(msg);
  }

  // Normal CLI path
  if (parsed.success) {
    cachedEnv = parsed.data;
    return parsed.data;
  }

  const errors = parsed.error.flatten().fieldErrors;

  console.error('\n' + '='.repeat(70));
  console.error('🔐  AUTHENTICATION REQUIRED');
  console.error('='.repeat(70));
  console.error('\nThis command needs a configured trading wallet (PRIVATE_KEY + WALLET_ADDRESS).');
  console.error('\nQuick setup:');
  console.error('  1. cp .env.example .env');
  console.error('  2. Edit .env and fill in at minimum:');
  console.error('       PRIVATE_KEY=0x...     (dedicated trading wallet — small funds only!)');
  console.error('       WALLET_ADDRESS=0x...');
  console.error('\n  (Optional but recommended for production: add BUILDER_API_KEY etc.)');
  console.error('\nRead-only commands like "discover" and "market" work without any .env file.');
  console.error('\nFull instructions: see README.md → "Environment Setup"');
  console.error('\nValidation errors:');
  console.error(errors);
  console.error('\n' + '='.repeat(70) + '\n');

  process.exit(1);
}

/** Convenience export for code that just wants the (possibly partial) env. */
export const env = getEnv();
