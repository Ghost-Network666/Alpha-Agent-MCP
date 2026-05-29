import type { PublicClient, SecureClient } from '@polymarket/client';
import { EventEmitter } from 'events';
import { logWs } from '../utils/logger.js';

export type AnySubscriptionSpec = any;
export type RealtimeEvent = any; // SDK provides precise unions based on specs (MarketBookEvent | UserEvent | ...)

const DEFAULT_BACKOFF_MS = [1000, 2000, 5000, 10000, 30000];
const MAX_RECONNECTS = 50;

export interface ReconnectingSubscriptionOptions {
  /** Max reconnect attempts (default 50) */
  maxReconnects?: number;
  /** Backoff schedule in ms */
  backoffMs?: number[];
  /** Called on every received event */
  onEvent?: (event: RealtimeEvent) => void;
  /** Called after successful (re)connect */
  onConnect?: () => void;
  /** Called on permanent failure */
  onFatal?: (err: Error) => void;
}

/**
 * Production-grade wrapper around SDK client.subscribe() with automatic reconnect + exponential backoff.
 * Emits 'event', 'connect', 'disconnect', 'error'.
 * Also exposes async iterator for for-await consumption.
 */
export class ReconnectingSubscription extends EventEmitter {
  private handle: any | null = null;
  private reconnectCount = 0;
  private closed = false;
  private client: PublicClient | SecureClient;
  private specs: readonly any[];
  private opts: ReconnectingSubscriptionOptions;

  constructor(
    client: PublicClient | SecureClient,
    specs: readonly any[],
    opts: ReconnectingSubscriptionOptions = {}
  ) {
    super();
    this.client = client;
    this.specs = specs;
    this.opts = {
      maxReconnects: MAX_RECONNECTS,
      backoffMs: DEFAULT_BACKOFF_MS,
      ...opts,
    };
  }

  async start(): Promise<void> {
    if (this.closed) throw new Error('Subscription permanently closed');
    try {
      this.handle = await (this.client as any).subscribe(this.specs as any);
      this.reconnectCount = 0;
      logWs('WebSocket subscription established', { topics: this.specs.map((s) => (s as any).topic) });
      this.emit('connect');
      this.opts.onConnect?.();

      // Consume the async iterable in background
      (async () => {
        try {
          if (!this.handle) return;
          for await (const event of this.handle) {
            if (this.closed) break;
            this.emit('event', event);
            this.opts.onEvent?.(event);
          }
        } catch (err) {
          if (!this.closed) {
            logWs('Subscription stream error', { error: (err as Error).message });
            this.emit('error', err);
            await this.reconnect();
          }
        }
      })();
    } catch (err) {
      logWs('Initial subscribe failed', { error: (err as Error).message });
      await this.reconnect();
    }
  }

  private async reconnect(): Promise<void> {
    if (this.closed) return;
    this.reconnectCount++;
    const max = this.opts.maxReconnects!;
    if (this.reconnectCount > max) {
      const fatal = new Error(`WebSocket reconnect limit reached (${max})`);
      this.emit('fatal', fatal);
      this.opts.onFatal?.(fatal);
      this.close();
      return;
    }

    const delays = this.opts.backoffMs!;
    const delay = delays[Math.min(this.reconnectCount - 1, delays.length - 1)];
    logWs(`Reconnecting in ${delay}ms (attempt ${this.reconnectCount}/${max})`);
    this.emit('disconnect', { attempt: this.reconnectCount });

    await new Promise((r) => setTimeout(r, delay));

    try {
      await this.start();
    } catch (e) {
      // start() already schedules next reconnect
    }
  }

  async close(): Promise<void> {
    this.closed = true;
    if (this.handle) {
      try {
        await this.handle.close();
      } catch {
        /* ignore */
      }
      this.handle = null;
    }
    this.removeAllListeners();
    logWs('Subscription closed');
  }

  /** Async iterable interface (replays live events while open) */
  async *[Symbol.asyncIterator](): AsyncGenerator<RealtimeEvent> {
    // Simple passthrough via emitter + queue for consumers who prefer for-await
    const queue: RealtimeEvent[] = [];
    let resolve: ((v?: any) => void) | null = null;

    const push = (ev: RealtimeEvent) => {
      if (resolve) {
        resolve(ev);
        resolve = null;
      } else {
        queue.push(ev);
      }
    };

    const handler = (ev: RealtimeEvent) => push(ev);
    this.on('event', handler);

    try {
      while (!this.closed) {
        if (queue.length) {
          yield queue.shift()!;
        } else {
          await new Promise<RealtimeEvent>((r) => (resolve = r));
          // resolve will be called by push
        }
      }
    } finally {
      this.off('event', handler);
    }
  }
}

/**
 * Factory for market book + price updates (public or authenticated).
 */
export function createMarketSubscription(
  client: PublicClient | SecureClient,
  tokenIds: string[],
  opts?: ReconnectingSubscriptionOptions
): ReconnectingSubscription {
  return new ReconnectingSubscription(client, [{ topic: 'market', tokenIds }], opts);
}

/**
 * Factory for authenticated user channel (fills, order updates, balance changes).
 * Use only with SecureClient.
 */
export function createUserSubscription(
  secureClient: SecureClient,
  markets?: string[],
  opts?: ReconnectingSubscriptionOptions
): ReconnectingSubscription {
  return new ReconnectingSubscription(secureClient, [{ topic: 'user', markets }], opts);
}
