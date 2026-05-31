import {
  createPublicClient,
  createSecureClient,
  type PublicClient,
  type SecureClient,
  type PublicActions,
  type SecureActions,
  relayerApiKey,
} from '@polymarket/client';
import { builderApiKey } from '@polymarket/client/node';
import { privateKey } from '@polymarket/client/viem';
import { logger } from '../utils/logger.js';
import { requireAuthEnv } from './env.js';

let publicClientInstance: PublicClient<PublicActions, SecureActions> | null = null;

/**
 * We maintain separate cached SecureClient instances for each auth strategy.
 * This follows the SDK design: each createSecureClient() receives exactly one
 * ApiKeyAuthorization (builder, relayer, or none). You cannot combine builder +
 * relayer on a single client instance.
 *
 * Per Suhail's guidance: use the public client for normal reads, and the
 * appropriate secure client (or multiple) for CLOB/authenticated operations.
 */
type SecureClientKey = 'relayer' | 'builder' | 'eoa';
const secureClientCache = new Map<SecureClientKey, SecureClient<PublicActions, SecureActions>>();

export function getPublicClient(): PublicClient<PublicActions, SecureActions> {
  if (!publicClientInstance) {
    publicClientInstance = createPublicClient();
    logger.debug('Public client initialized');
  }
  return publicClientInstance;
}

/** Internal: create a fresh SecureClient for a specific auth strategy */
async function createSecureClientForStrategy(
  auth: ReturnType<typeof requireAuthEnv>,
  strategy: SecureClientKey
): Promise<SecureClient<PublicActions, SecureActions>> {
  const signer = privateKey(auth.PRIVATE_KEY);

  const options: Parameters<typeof createSecureClient>[0] = {
    wallet: auth.WALLET_ADDRESS,
    signer,
  };

  if (strategy === 'relayer') {
    if (!auth.RELAYER_API_KEY || !auth.RELAYER_API_KEY_ADDRESS) {
      throw new Error('Relayer client requested but RELAYER_API_KEY / RELAYER_API_KEY_ADDRESS are not configured');
    }
    options.apiKey = relayerApiKey({
      key: auth.RELAYER_API_KEY,
      address: auth.RELAYER_API_KEY_ADDRESS,
    });
    logger.info('Creating Relayer API key client (gasless)');

    if (auth.BUILDER_API_KEY && auth.BUILDER_SECRET && auth.BUILDER_PASSPHRASE) {
      logger.info('Builder keys also present — Relayer should be linked to this builder for attribution/rewards');
    }
  } else if (strategy === 'builder') {
    if (!auth.BUILDER_API_KEY || !auth.BUILDER_SECRET || !auth.BUILDER_PASSPHRASE) {
      throw new Error('Builder client requested but BUILDER_API_KEY / BUILDER_SECRET / BUILDER_PASSPHRASE are not configured');
    }
    options.apiKey = builderApiKey({
      key: auth.BUILDER_API_KEY,
      secret: auth.BUILDER_SECRET,
      passphrase: auth.BUILDER_PASSPHRASE,
    });
    logger.info('Creating Builder API key client (no gasless)');
  } else {
    // eoa / L1 signature only
    logger.warn('Creating EOA-only SecureClient (L1 wallet signatures — lower limits, no gasless)');
  }

  const client = await createSecureClient(options);
  logger.info('Secure client initialized', { wallet: auth.WALLET_ADDRESS, strategy });
  return client;
}

/** Returns (or creates) the Relayer-backed secure client. Best for gasless trading. */
export async function getRelayerClient(): Promise<SecureClient<PublicActions, SecureActions>> {
  const cached = secureClientCache.get('relayer');
  if (cached) return cached;

  const auth = requireAuthEnv();
  const client = await createSecureClientForStrategy(auth, 'relayer');
  secureClientCache.set('relayer', client);
  return client;
}

/** Returns (or creates) the Builder-backed secure client (direct HMAC, no gasless). */
export async function getBuilderClient(): Promise<SecureClient<PublicActions, SecureActions>> {
  const cached = secureClientCache.get('builder');
  if (cached) return cached;

  const auth = requireAuthEnv();
  const client = await createSecureClientForStrategy(auth, 'builder');
  secureClientCache.set('builder', client);
  return client;
}

/**
 * Smart default authenticated client.
 *
 * - Prefers Relayer (gasless) when RELAYER_API_KEY + ADDRESS are present.
 * - Falls back to Builder when only Builder keys are present.
 * - Falls back to pure EOA L1 signature auth otherwise.
 *
 * This is the recommended entry point for most trading/account tools.
 * Use the explicit getRelayerClient() / getBuilderClient() only when you need a specific strategy.
 */
export async function getSecureClient(): Promise<SecureClient<PublicActions, SecureActions>> {
  const auth = requireAuthEnv(); // validates wallet at minimum

  const hasRelayer = !!(auth.RELAYER_API_KEY && auth.RELAYER_API_KEY_ADDRESS);
  const hasBuilder = !!(auth.BUILDER_API_KEY && auth.BUILDER_SECRET && auth.BUILDER_PASSPHRASE);

  if (hasRelayer) {
    return getRelayerClient();
  }
  if (hasBuilder) {
    return getBuilderClient();
  }
  // EOA fallback (no apiKey) — still cached under 'eoa'
  const cached = secureClientCache.get('eoa');
  if (cached) return cached;

  const client = await createSecureClientForStrategy(auth, 'eoa');
  secureClientCache.set('eoa', client);
  return client;
}

/**
 * One-time setup for new wallets. Call this manually or on first run.
 * Sets up gasless wallet (if using relayer) + trading approvals (CTF + collateral).
 *
 * Pass the specific client you want configured (e.g. from getRelayerClient() or getSecureClient()).
 * The cache for that strategy will be updated if setupGaslessWallet returns a new instance.
 */
export async function ensureTradingSetup(secureClient: SecureClient<PublicActions, SecureActions>): Promise<void> {
  // Belt-and-suspenders: ensure we have valid auth even if someone calls this directly
  requireAuthEnv();

  const isGasless = await secureClient.isGaslessReady().catch(() => false);
  if (!isGasless) {
    logger.info('Setting up gasless wallet...');
    try {
      const updated = await secureClient.setupGaslessWallet();
      // Best-effort: if the client was one of our cached ones, refresh it.
      // We walk the cache (small) and replace any reference that matches by identity.
      for (const [key, cached] of secureClientCache.entries()) {
        if (cached === secureClient) {
          secureClientCache.set(key, updated);
          break;
        }
      }
      logger.info('Gasless wallet setup complete');
    } catch (err) {
      logger.warn('Gasless setup skipped or failed (may not be required)', { error: (err as Error).message });
    }
  }

  // Always ensure trading approvals (idempotent-ish)
  logger.info('Ensuring trading approvals (ERC20 + CTF setApprovalForAll)...');
  const handle = await secureClient.setupTradingApprovals();
  await handle.wait();
  logger.info('Trading approvals confirmed');
}
