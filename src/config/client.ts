import {
  createPublicClient,
  createSecureClient,
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
    publicClientInstance = createPublicClient();
    logger.debug('Public client initialized');
  }
  return publicClientInstance;
}

/**
 * Creates the SecureClient using exactly the required pattern per SDK + MCP spec:
 *   wallet = deposit wallet address (DEPOSIT_WALLET_ADDRESS or WALLET_ADDRESS)
 *   signer = privateKey(EOA_PRIVATE_KEY or PRIVATE_KEY) from @polymarket/client/viem
 *
 * No other auth patterns (no relayer/builder apiKey injection here). Gasless is
 * enabled post-creation via setupGaslessWallet() which returns a replacement client.
 */
export async function getSecureClient(): Promise<SecureClient<PublicActions, SecureActions>> {
  if (secureClientInstance) return secureClientInstance;

  const pk = process.env.EOA_PRIVATE_KEY || process.env.PRIVATE_KEY;
  const wallet = process.env.DEPOSIT_WALLET_ADDRESS || process.env.WALLET_ADDRESS;

  if (!pk || !wallet) {
    throw new Error('Missing EOA_PRIVATE_KEY/PRIVATE_KEY and DEPOSIT_WALLET_ADDRESS/WALLET_ADDRESS for secure client');
  }

  const signer = privateKey(pk);
  secureClientInstance = await createSecureClient({ wallet, signer });
  logger.info('Secure client initialized (EOA signer + deposit wallet only)');
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
