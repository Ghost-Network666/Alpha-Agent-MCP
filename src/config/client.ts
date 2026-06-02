import {
  createPublicClient,
  createSecureClient,
  allActions,
  type PublicClient,
  type SecureClient,
  type PublicActions,
  type SecureActions,
} from '@polymarket/client';
import { privateKey } from '@polymarket/client/viem';
import { logger } from '../utils/logger.js';

let publicClientInstance: PublicClient<PublicActions, SecureActions> | null = null;
let secureClientInstance: SecureClient<PublicActions, SecureActions> | null = null;

export function getPublicClient(): PublicClient<PublicActions, SecureActions> {
  if (!publicClientInstance) {
    // Explicit extend(allActions) for full exhaustive coverage of the unified TS SDK surface (discovery, data, analytics, etc.)
    // per the documented client factory + decorator pattern.
    const raw = createPublicClient();
    publicClientInstance = raw.extend(allActions);
    logger.debug('Public client initialized (with allActions)');
  }
  return publicClientInstance;
}

/**
 * Creates the SecureClient using exactly the required pattern per SDK + MCP spec (full exhaustive):
 *   wallet = deposit wallet address (DEPOSIT_WALLET_ADDRESS or WALLET_ADDRESS)
 *   signer = privateKey(EOA_PRIVATE_KEY or PRIVATE_KEY) from @polymarket/client/viem
 *   + relayer/builder/apiKey when present in env (for gasless + builder attribution per SDK createSecureClient options).
 *
 * Gasless is enabled post-creation via setupGaslessWallet() which returns a replacement client.
 */
export async function getSecureClient(): Promise<SecureClient<PublicActions, SecureActions>> {
  if (secureClientInstance) return secureClientInstance;

  const pk = process.env.EOA_PRIVATE_KEY || process.env.PRIVATE_KEY;
  const wallet = process.env.DEPOSIT_WALLET_ADDRESS || process.env.WALLET_ADDRESS;

  if (!pk || !wallet) {
    throw new Error('Missing EOA_PRIVATE_KEY/PRIVATE_KEY and DEPOSIT_WALLET_ADDRESS/WALLET_ADDRESS for secure client');
  }

  const signer = privateKey(pk);

  // Full exhaustive auth support per SDK createSecureClient options + spec (relayer/builder/apiKey for gasless/attribution + EOA signer + deposit wallet).
  // Explicit extend(allActions) for full surface (trading, wallet, secure account, rewards, etc.).
  const config: any = { wallet, signer };
  if (process.env.RELAYER_API_KEY && process.env.RELAYER_API_KEY_ADDRESS) {
    config.apiKey = { key: process.env.RELAYER_API_KEY, address: process.env.RELAYER_API_KEY_ADDRESS };
  } else if (process.env.BUILDER_API_KEY && process.env.BUILDER_SECRET && process.env.BUILDER_PASSPHRASE) {
    // Builder HMAC path (SDK accepts via other means or post; here we note for completeness; gasless prefers relayer).
    config.builder = { key: process.env.BUILDER_API_KEY, secret: process.env.BUILDER_SECRET, passphrase: process.env.BUILDER_PASSPHRASE };
  }
  const raw = await createSecureClient(config);
  secureClientInstance = raw.extend(allActions);
  logger.info('Secure client initialized (full auth support + EOA signer + deposit wallet, with allActions)');
  return secureClientInstance;
}

/**
 * Call setupGaslessWallet on the current secure client and replace the cached
 * instance with the returned client (per SDK contract and MCP requirement).
 * Returns the new client.
 */
export async function setupGaslessWallet(): Promise<SecureClient<PublicActions, SecureActions>> {
  const current = await getSecureClient();
  const updated = await current.setupGaslessWallet();
  secureClientInstance = updated;
  logger.info('Gasless wallet setup complete; active secure client replaced');
  return updated;
}

/**
 * Convenience for library consumers: ensure gasless + approvals on a client you hold.
 * For MCP, use the 'setup_gasless_wallet' tool + the trading approval tools directly.
 */
export async function ensureTradingSetup(secureClient: SecureClient<PublicActions, SecureActions>): Promise<void> {
  const isGasless = await secureClient.isGaslessReady().catch(() => false);
  if (!isGasless) {
    logger.info('Setting up gasless wallet...');
    try {
      // The returned client should be used by caller for subsequent ops (MCP factory auto-replaces via its wrapper)
      await secureClient.setupGaslessWallet();
      logger.info('Gasless wallet setup complete');
    } catch (err) {
      logger.warn('Gasless setup skipped or failed (may not be required)', { error: (err as Error).message });
    }
  }

  logger.info('Ensuring trading approvals (ERC20 + CTF setApprovalForAll)...');
  const handle = await secureClient.setupTradingApprovals();
  await handle.wait();
  logger.info('Trading approvals confirmed');
}
