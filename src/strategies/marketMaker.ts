import { OrderSide } from '@polymarket/client';
import { getPublicClient, getSecureClient } from '../config/client.js';
import { getMarket } from '../data/markets.js';
import { getBookSnapshot, getMidpoint } from '../data/orderbook.js';
import { submitLimitOrder, cancelSingleOrder, getOpenOrders } from '../trading/orders.js';
import { createMarketSubscription, createUserSubscription, type ReconnectingSubscription } from '../websocket/subscriptions.js';
import { logger, logTrade } from '../utils/logger.js';
import { getEnv } from '../config/env.js';

interface Quote {
  orderId?: string;
  price: string;
  size: string;
  side: OrderSide;
}

interface MarketMakerConfig {
  tokenId: string;
  /** Target spread in basis points (e.g. 50 = 0.50%) */
  targetSpreadBps: number;
  /** Size per side in USDC (collateral) */
  quoteSize: number;
  /** Max total exposure per side before pausing */
  maxExposure: number;
  /** Seconds between quote refresh cycles */
  refreshIntervalSec: number;
  /** Minimum price increment (usually 0.01 for most markets) */
  tickSize?: number;
}

export class SimpleMarketMaker {
  private config: MarketMakerConfig;
  private tokenId: string;

  private bidQuote: Quote | null = null;
  private askQuote: Quote | null = null;

  private marketSub?: ReconnectingSubscription;
  private userSub?: ReconnectingSubscription;

  private running = false;
  private refreshTimer?: NodeJS.Timeout;
  private lastMid = '0.5';

  constructor(cfg: Partial<MarketMakerConfig> & { tokenId: string }) {
    this.tokenId = cfg.tokenId;
    const e = getEnv();
    this.config = {
      targetSpreadBps: e.QUOTE_SPREAD_BPS,
      quoteSize: e.QUOTE_SIZE_USDC,
      maxExposure: e.MAX_POSITION_USDC,
      refreshIntervalSec: 45,
      tickSize: 0.01,
      ...cfg,
    };
  }

  async initialize() {
    logger.info('MarketMaker initializing', { tokenId: this.tokenId.slice(0, 12) + '...' });
    // Try to enrich with market metadata if possible (best effort)
    logger.info('MarketMaker ready', { spreadBps: this.config.targetSpreadBps, size: this.config.quoteSize });
  }

  /**
   * Start the market maker loop + realtime feeds.
   */
  async start() {
    if (this.running) return;
    this.running = true;
    await this.initialize();

    const secureClient = await getSecureClient();
    const publicClient = getPublicClient();

    // 1. Subscribe to market data (book updates)
    this.marketSub = createMarketSubscription(publicClient, [this.tokenId], {
      onEvent: (ev) => this.handleMarketEvent(ev),
    });
    await this.marketSub.start();

    // 2. Subscribe to personal user channel for fills/cancels
    this.userSub = createUserSubscription(secureClient, undefined, {
      onEvent: (ev) => this.handleUserEvent(ev),
    });
    await this.userSub.start();

    // 3. Initial quote placement + periodic refresh
    await this.refreshQuotes();

    this.refreshTimer = setInterval(() => {
      this.refreshQuotes().catch((e) => logger.error('Refresh cycle failed', { error: e.message }));
    }, this.config.refreshIntervalSec * 1000);

    logger.info('MarketMaker started — streaming + quoting');
  }

  async stop() {
    this.running = false;
    if (this.refreshTimer) clearInterval(this.refreshTimer);

    // Best-effort cancel open quotes
    await this.cancelExistingQuotes().catch(() => {});

    await this.marketSub?.close();
    await this.userSub?.close();

    logger.info('MarketMaker stopped');
  }

  private async handleMarketEvent(event: any) {
    if (event.type === 'book' && event.tokenId === this.tokenId) {
      // Significant book change → consider re-quoting (debounced via timer mostly)
      logTrade('Market book update received', { tokenId: event.tokenId?.slice(0, 8) });
      // Could implement smarter delta logic here
    }
  }

  private async handleUserEvent(event: any) {
    // User channel events include order status changes and trades (fills)
    if (event.type === 'trade' || event.type === 'order') {
      logTrade('User event (possible fill)', { type: event.type, orderId: event.orderId });
      // On fill or partial fill, immediately refresh quotes to stay tight
      this.refreshQuotes().catch((e) => logger.warn('Post-fill refresh failed', { error: e.message }));
    }
  }

  /**
   * Core quoting logic: calculate tight two-sided quotes around midpoint and (re)place.
   */
  private async refreshQuotes() {
    if (!this.running) return;

    try {
      const snapshot = await getBookSnapshot(this.tokenId);
      const mid = parseFloat(snapshot.midpoint || (await getMidpoint(this.tokenId)));
      this.lastMid = mid.toFixed(4);

      const spread = Math.max(this.config.targetSpreadBps / 10000, 0.0005); // min 5bps safety
      const half = spread / 2;

      const bidPrice = Math.max(0.001, mid - half);
      const askPrice = Math.min(0.999, mid + half);

      // Round to tick (most markets 0.01 or 0.001)
      const tick = this.config.tickSize ?? 0.01;
      const roundedBid = (Math.floor(bidPrice / tick) * tick).toFixed(2);
      const roundedAsk = (Math.ceil(askPrice / tick) * tick).toFixed(2);

      const size = this.config.quoteSize.toFixed(2);

      // Simple inventory guard (real impl would track live positions)
      // Inventory awareness placeholder (expand with real position tracking)
      await getOpenOrders({ tokenId: this.tokenId }).catch(() => []);

      logger.debug('Quote calc', { mid: this.lastMid, bid: roundedBid, ask: roundedAsk });

      // Cancel stale quotes first
      await this.cancelExistingQuotes();

      // Place fresh two-sided quotes (fire and forget style; production would await sequentially)
      const [bidResp, askResp] = await Promise.allSettled([
        submitLimitOrder({
          tokenId: this.tokenId,
          side: OrderSide.BUY,
          price: parseFloat(roundedBid),
          size: parseFloat(size),
        }),
        submitLimitOrder({
          tokenId: this.tokenId,
          side: OrderSide.SELL,
          price: parseFloat(roundedAsk),
          size: parseFloat(size),
        }),
      ]);

      if (bidResp.status === 'fulfilled' && bidResp.value.ok) {
        this.bidQuote = { orderId: bidResp.value.orderId, price: roundedBid, size, side: OrderSide.BUY };
      }
      if (askResp.status === 'fulfilled' && askResp.value.ok) {
        this.askQuote = { orderId: askResp.value.orderId, price: roundedAsk, size, side: OrderSide.SELL };
      }

      logTrade('Quotes refreshed', {
        mid: this.lastMid,
        bid: roundedBid,
        ask: roundedAsk,
        spreadBps: ((parseFloat(roundedAsk) - parseFloat(roundedBid)) * 10000).toFixed(0),
      });
    } catch (err: any) {
      logger.warn('Quote refresh error', { error: err.message });
    }
  }

  private async cancelExistingQuotes() {
    const toCancel: string[] = [];
    if (this.bidQuote?.orderId) toCancel.push(this.bidQuote.orderId);
    if (this.askQuote?.orderId) toCancel.push(this.askQuote.orderId);

    for (const id of toCancel) {
      try {
        await cancelSingleOrder(id);
      } catch {
        /* order may have filled or already cancelled */
      }
    }
    this.bidQuote = null;
    this.askQuote = null;
  }
}

/**
 * Convenience launcher for the example strategy.
 * Resolves a market slug or uses explicit tokenId from env.
 */
export async function runExampleMarketMaker(tokenIdOrSlug?: string) {
  const e = getEnv();
  const identifier = tokenIdOrSlug || e.DEFAULT_TOKEN_ID || e.DEFAULT_MARKET_SLUG;
  if (!identifier) {
    throw new Error('Provide tokenId or set DEFAULT_MARKET_SLUG / DEFAULT_TOKEN_ID in .env');
  }

  let tokenId = identifier;
  if (!tokenId.startsWith('0x') && tokenId.length < 40) {
    // treat as slug
    const m = await getMarket({ slug: tokenId });
    // For binary markets take the first (YES) outcome token
    const outcomes: any = (m as any).outcomes || {};
    tokenId = outcomes.yes?.tokenId || (Array.isArray(outcomes) ? outcomes[0]?.tokenId : undefined);
    if (!tokenId) throw new Error('Could not resolve tokenId from market');
    logger.info('Resolved token from slug', { slug: identifier, tokenId: tokenId.slice(0, 12) });
  }

  const mm = new SimpleMarketMaker({
    tokenId,
    targetSpreadBps: e.QUOTE_SPREAD_BPS,
    quoteSize: e.QUOTE_SIZE_USDC,
    maxExposure: e.MAX_POSITION_USDC,
  });

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down market maker...');
    await mm.stop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  await mm.start();
  return mm;
}
