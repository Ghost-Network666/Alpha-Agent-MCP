import { getSecureClient } from '../config/client.js';
import { collectAll } from '../utils/pagination.js';
import { withErrorHandling } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

const secure = () => getSecureClient();

export async function getPositions(params?: { market?: string[] }) {
  const client = await secure();
  const paginator = client.listPositions({ pageSize: 100, ...params });
  return collectAll(paginator, { maxPages: 20 });
}

export async function getActivity(params?: { market?: string[]; type?: string }) {
  const client = await secure();
  const paginator = client.listActivity({ pageSize: 50, ...params } as any);
  return collectAll(paginator, { maxPages: 30 });
}

export async function getAccountTrades(tokenId?: string) {
  const client = await secure();
  const paginator = client.listAccountTrades(tokenId ? { tokenId } : {});
  return collectAll(paginator, { maxPages: 50 });
}

export async function getPortfolioValue(marketIds?: string[]) {
  const client = await secure();
  return withErrorHandling(
    () => client.fetchPortfolioValue({ market: marketIds }),
    'account.fetchPortfolioValue'
  );
}

export async function getNotifications() {
  const client = await secure();
  return withErrorHandling(() => client.fetchNotifications(), 'account.fetchNotifications');
}

/**
 * Quick health/readiness for the authenticated account.
 */
export async function getAccountSummary() {
  const [positions, activity, portfolio] = await Promise.all([
    getPositions().catch(() => []),
    getActivity().catch(() => []),
    getPortfolioValue().catch(() => null),
  ]);
  logger.info('Account summary', {
    openPositions: positions.length,
    recentActivity: activity.length,
    portfolioValue: portfolio,
  });
  return { positions, activity, portfolio };
}
