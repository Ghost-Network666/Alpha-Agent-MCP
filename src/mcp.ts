import 'dotenv/config';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  SubscribeRequestSchema,
  UnsubscribeRequestSchema,
  ListResourceTemplatesRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { getPublicClient, getSecureClient } from './lib.js';
import * as F from './formatters.js';
import { createResourceManager, RESOURCE_CAPABILITIES } from './mcp/resources.js';

// Map prompt-specified env var names (EOA_PRIVATE_KEY / DEPOSIT_WALLET_ADDRESS)
// onto the names expected by the existing getPublicClient / getSecureClient factories.
// This lets the MCP server work without modifying any other file in the codebase.
function normalizeEnvAliases() {
  if (process.env.EOA_PRIVATE_KEY && !process.env.PRIVATE_KEY) {
    process.env.PRIVATE_KEY = process.env.EOA_PRIVATE_KEY;
  }
  if (process.env.DEPOSIT_WALLET_ADDRESS && !process.env.WALLET_ADDRESS) {
    process.env.WALLET_ADDRESS = process.env.DEPOSIT_WALLET_ADDRESS;
  }
}
normalizeEnvAliases();

// All logging MUST go to stderr. Stdout is strictly for the MCP JSON-RPC protocol.
const server = new Server(
  { name: 'polymarket-mcp', version: '1.0.0' },
  {
    capabilities: {
      tools: {},
      resources: RESOURCE_CAPABILITIES,
    },
  }
);

// Resource manager (powers live subscriptions via WebSocket → MCP notifications/resources/updated)
const resourceManager = createResourceManager(
  server,
  () => getPublicClient(),
  async () => await getSecureClient()
);

// Safe wrapper: never throw, always return MCP content or { isError: true }
async function callTool<T>(fn: () => Promise<T>, toolName: string) {
  try {
    const result = await fn();
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify(result, (_k, v) => (typeof v === 'bigint' ? v.toString() : v), 2)
      }]
    };
  } catch (error: any) {
    return {
      isError: true,
      content: [{ type: 'text' as const, text: `Error in ${toolName}: ${error?.message || String(error)}` }]
    };
  }
}

// Paginated tools: call .firstPage() and return page.items (as required)
async function callPaginated(paginatorPromise: Promise<any>, toolName: string) {
  try {
    const paginator = await paginatorPromise;
    const page = await (typeof paginator.firstPage === 'function'
      ? paginator.firstPage()
      : (typeof paginator.next === 'function' ? paginator.next() : null));
    const items = page?.items ?? page?.data ?? (Array.isArray(page) ? page : []);
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify(items, (_k, v) => (typeof v === 'bigint' ? v.toString() : v), 2)
      }]
    };
  } catch (error: any) {
    return {
      isError: true,
      content: [{ type: 'text' as const, text: `Error in ${toolName}: ${error?.message || String(error)}` }]
    };
  }
}

// Formatting wrappers — reuse stringify logic, never touch original callTool / callPaginated
async function callWithFormat<T>(fn: () => Promise<T>, formatter: (d: T) => any, toolName: string) {
  try {
    const result = await fn();
    const formatted = formatter(result);
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify(formatted, (_k, v) => (typeof v === 'bigint' ? v.toString() : v), 2)
      }]
    };
  } catch (error: any) {
    return {
      isError: true,
      content: [{ type: 'text' as const, text: `Error in ${toolName}: ${error?.message || String(error)}` }]
    };
  }
}

async function callPaginatedWithFormat(paginatorPromise: Promise<any>, formatter: (item: any) => any, toolName: string) {
  try {
    const paginator = await paginatorPromise;
    const page = await (typeof paginator.firstPage === 'function'
      ? paginator.firstPage()
      : (typeof paginator.next === 'function' ? paginator.next() : null));
    const items = page?.items ?? page?.data ?? (Array.isArray(page) ? page : []);
    const formatted = Array.isArray(items) ? items.map(formatter) : formatter(items);
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify(formatted, (_k, v) => (typeof v === 'bigint' ? v.toString() : v), 2)
      }]
    };
  } catch (error: any) {
    return {
      isError: true,
      content: [{ type: 'text' as const, text: `Error in ${toolName}: ${error?.message || String(error)}` }]
    };
  }
}

// ==================== TOOL DEFINITIONS (exactly per spec) ====================

const publicTools = [
  {
    name: 'list_markets',
    description: 'List Polymarket markets',
    inputSchema: {
      type: 'object',
      properties: {
        closed: { type: 'boolean' },
        pageSize: { type: 'number' }
      }
    }
  },
  {
    name: 'fetch_market',
    description: 'Fetch a single market by id, slug or url',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        slug: { type: 'string' },
        url: { type: 'string' }
      }
    }
  },
  {
    name: 'list_events',
    description: 'List Polymarket events',
    inputSchema: {
      type: 'object',
      properties: {
        pageSize: { type: 'number' }
      }
    }
  },
  {
    name: 'fetch_event',
    description: 'Fetch a single event by id or slug',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        slug: { type: 'string' }
      }
    }
  },
  {
    name: 'search',
    description: 'Full-text search across markets and events',
    inputSchema: {
      type: 'object',
      properties: {
        q: { type: 'string' },
        pageSize: { type: 'number' }
      },
      required: ['q']
    }
  },
  {
    name: 'fetch_order_book',
    description: 'Fetch current order book for a token',
    inputSchema: {
      type: 'object',
      properties: {
        tokenId: { type: 'string' }
      },
      required: ['tokenId']
    }
  },
  {
    name: 'fetch_price',
    description: 'Fetch last trade price for a side',
    inputSchema: {
      type: 'object',
      properties: {
        tokenId: { type: 'string' },
        side: { type: 'string', enum: ['BUY', 'SELL'] }
      },
      required: ['tokenId', 'side']
    }
  },
  {
    name: 'fetch_midpoint',
    description: 'Fetch current midpoint price for a token',
    inputSchema: {
      type: 'object',
      properties: {
        tokenId: { type: 'string' }
      },
      required: ['tokenId']
    }
  },
  {
    name: 'fetch_spread',
    description: 'Fetch current spread for a token',
    inputSchema: {
      type: 'object',
      properties: {
        tokenId: { type: 'string' }
      },
      required: ['tokenId']
    }
  },
  {
    name: 'fetch_price_history',
    description: 'Fetch price history for a token',
    inputSchema: {
      type: 'object',
      properties: {
        tokenId: { type: 'string' },
        interval: { type: 'string' }
      },
      required: ['tokenId']
    }
  },
  {
    name: 'fetch_last_trade_price',
    description: 'Fetch the most recent trade price for a token',
    inputSchema: {
      type: 'object',
      properties: {
        tokenId: { type: 'string' }
      },
      required: ['tokenId']
    }
  },
  {
    name: 'list_trades',
    description: 'List recent trades (optionally filtered by user)',
    inputSchema: {
      type: 'object',
      properties: {
        user: { type: 'string' },
        pageSize: { type: 'number' }
      }
    }
  },
  {
    name: 'estimate_market_price',
    description: 'Estimate price impact for a market order',
    inputSchema: {
      type: 'object',
      properties: {
        tokenId: { type: 'string' },
        side: { type: 'string', enum: ['BUY', 'SELL'] },
        amount: { type: 'number' }
      },
      required: ['tokenId', 'side', 'amount']
    }
  },

  // Leaderboards + Public Profiles (public)
  {
    name: 'list_builder_leaderboard',
    description: 'List top builders by volume',
    inputSchema: {
      type: 'object',
      properties: {
        pageSize: { type: 'number' },
        timePeriod: { type: 'string', enum: ['DAY', 'WEEK', 'MONTH', 'ALL'] }
      }
    }
  },
  {
    name: 'list_trader_leaderboard',
    description: 'List top traders by PNL or volume',
    inputSchema: {
      type: 'object',
      properties: {
        pageSize: { type: 'number' },
        timePeriod: { type: 'string', enum: ['DAY', 'WEEK', 'MONTH', 'ALL'] },
        orderBy: { type: 'string', enum: ['PNL', 'VOL'] }
      }
    }
  },
  {
    name: 'fetch_public_profile',
    description: 'Fetch public profile by wallet address',
    inputSchema: {
      type: 'object',
      properties: {
        address: { type: 'string' }
      },
      required: ['address']
    }
  },

  // Reward programs (public viewing)
  {
    name: 'list_current_rewards',
    description: 'List currently active reward programs',
    inputSchema: {
      type: 'object',
      properties: {
        pageSize: { type: 'number' }
      }
    }
  },
  {
    name: 'list_market_rewards',
    description: 'List reward configuration for a specific market',
    inputSchema: {
      type: 'object',
      properties: {
        conditionId: { type: 'string' },
        pageSize: { type: 'number' }
      },
      required: ['conditionId']
    }
  }
];

const secureTools = [
  {
    name: 'place_limit_order',
    description: 'Place a limit order (requires EOA_PRIVATE_KEY + DEPOSIT_WALLET_ADDRESS)',
    inputSchema: {
      type: 'object',
      properties: {
        tokenId: { type: 'string' },
        price: { type: 'number' },
        size: { type: 'number' },
        side: { type: 'string', enum: ['BUY', 'SELL'] },
        postOnly: { type: 'boolean' }
      },
      required: ['tokenId', 'price', 'size', 'side']
    }
  },
  {
    name: 'place_market_order',
    description: 'Place a market order (requires EOA_PRIVATE_KEY + DEPOSIT_WALLET_ADDRESS)',
    inputSchema: {
      type: 'object',
      properties: {
        tokenId: { type: 'string' },
        amount: { type: 'number' },
        side: { type: 'string', enum: ['BUY', 'SELL'] }
      },
      required: ['tokenId', 'amount', 'side']
    }
  },
  {
    name: 'cancel_order',
    description: 'Cancel a single order',
    inputSchema: {
      type: 'object',
      properties: {
        orderId: { type: 'string' }
      },
      required: ['orderId']
    }
  },
  {
    name: 'cancel_orders',
    description: 'Cancel multiple orders',
    inputSchema: {
      type: 'object',
      properties: {
        orderIds: { type: 'array', items: { type: 'string' } }
      },
      required: ['orderIds']
    }
  },
  {
    name: 'cancel_all',
    description: 'Cancel all open orders for the authenticated wallet',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'cancel_market_orders',
    description: 'Cancel all orders for a specific market',
    inputSchema: {
      type: 'object',
      properties: {
        market: { type: 'string' }
      },
      required: ['market']
    }
  },
  {
    name: 'list_open_orders',
    description: 'List open orders (optionally filtered by market)',
    inputSchema: {
      type: 'object',
      properties: {
        market: { type: 'string' }
      }
    }
  },
  {
    name: 'fetch_order',
    description: 'Fetch details for a specific order',
    inputSchema: {
      type: 'object',
      properties: {
        orderId: { type: 'string' }
      },
      required: ['orderId']
    }
  },
  {
    name: 'list_positions',
    description: 'List current positions',
    inputSchema: {
      type: 'object',
      properties: {
        pageSize: { type: 'number' }
      }
    }
  },
  {
    name: 'list_closed_positions',
    description: 'List closed/resolved positions',
    inputSchema: {
      type: 'object',
      properties: {
        pageSize: { type: 'number' }
      }
    }
  },
  {
    name: 'fetch_portfolio_value',
    description: 'Get current portfolio value',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'list_activity',
    description: 'List recent account activity',
    inputSchema: {
      type: 'object',
      properties: {
        pageSize: { type: 'number' }
      }
    }
  },
  {
    name: 'list_account_trades',
    description: 'List historical trades for the account',
    inputSchema: {
      type: 'object',
      properties: {
        market: { type: 'string' }
      }
    }
  },
  {
    name: 'setup_trading_approvals',
    description: 'Set up trading approvals (ERC20 + CTF)',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'split_position',
    description: 'Split collateral into outcome tokens (CTF)',
    inputSchema: {
      type: 'object',
      properties: {
        conditionId: { type: 'string' },
        amount: { type: 'string' }
      },
      required: ['conditionId', 'amount']
    }
  },
  {
    name: 'merge_positions',
    description: 'Merge outcome tokens back into collateral (CTF)',
    inputSchema: {
      type: 'object',
      properties: {
        conditionId: { type: 'string' },
        amount: { type: 'string' }
      },
      required: ['conditionId', 'amount']
    }
  },
  {
    name: 'redeem_positions',
    description: 'Redeem resolved positions (by conditionId or marketId)',
    inputSchema: {
      type: 'object',
      properties: {
        conditionId: { type: 'string' },
        marketId: { type: 'string' }
      }
    }
  },

  // Reward tracking (authenticated viewing only)
  {
    name: 'fetch_reward_percentages',
    description: 'Fetch your current reward percentages',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'list_user_earnings_and_markets_config',
    description: 'List your reward earnings per market for a date',
    inputSchema: {
      type: 'object',
      properties: {
        date: { type: 'string' },
        pageSize: { type: 'number' }
      }
    }
  }
];

// Register tool list (MCP discovery)
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [...publicTools, ...secureTools]
}));

// Execute tools — every handler returns JSON. Errors never throw.
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  const pub = getPublicClient();
  let sec: any = null;

  const getSec = async () => {
    if (!sec) {
      sec = await getSecureClient();
    }
    return sec;
  };

  switch (name) {
    // Public tools (no auth) — every response formatted
    case 'list_markets':
      return callPaginatedWithFormat(pub.listMarkets(args), F.formatMarket, name);
    case 'fetch_market':
      return callWithFormat(() => pub.fetchMarket(args), F.formatMarket, name);
    case 'list_events':
      return callPaginatedWithFormat(pub.listEvents(args), F.formatEvent, name);
    case 'fetch_event':
      return callWithFormat(() => pub.fetchEvent(args), F.formatEvent, name);
    case 'search':
      // SearchResults is not Market[] — use formatSearchResults
      return callPaginatedWithFormat(pub.search(args), F.formatSearchResults, name);
    case 'fetch_order_book':
      return callWithFormat(() => pub.fetchOrderBook(args), F.formatOrderBook, name);
    case 'fetch_price':
      return callWithFormat(() => pub.fetchPrice(args), F.formatGeneric, name);
    case 'fetch_midpoint':
      return callWithFormat(() => pub.fetchMidpoint(args), F.formatGeneric, name);
    case 'fetch_spread':
      return callWithFormat(() => pub.fetchSpread(args), F.formatGeneric, name);
    case 'fetch_price_history':
      return callWithFormat(() => pub.fetchPriceHistory(args), (d: any) => F.formatPriceHistory(d?.history ?? d ?? []), name);
    case 'fetch_last_trade_price':
      return callWithFormat(() => pub.fetchLastTradePrice(args), F.formatGeneric, name);
    case 'list_trades':
      return callPaginatedWithFormat(pub.listTrades(args), F.formatTrade, name);
    case 'estimate_market_price':
      return callWithFormat(() => pub.estimateMarketPrice(args), F.formatGeneric, name);

    // Secure tools — every response formatted. CTF actions use resolved tx card.
    case 'place_limit_order':
      return callWithFormat(async () => (await getSec()).placeLimitOrder(args), F.formatOrderResponse, name);
    case 'place_market_order':
      return callWithFormat(async () => (await getSec()).placeMarketOrder(args), F.formatOrderResponse, name);
    case 'cancel_order':
      return callWithFormat(async () => (await getSec()).cancelOrder(args), F.formatCancelResponse, name);
    case 'cancel_orders':
      return callWithFormat(async () => (await getSec()).cancelOrders(args), F.formatCancelResponse, name);
    case 'cancel_all':
      return callWithFormat(async () => (await getSec()).cancelAll(), F.formatCancelResponse, name);
    case 'cancel_market_orders':
      return callWithFormat(async () => (await getSec()).cancelMarketOrders(args), F.formatCancelResponse, name);
    case 'list_open_orders':
      return callPaginatedWithFormat((await getSec()).listOpenOrders(args), F.formatOrder, name);
    case 'fetch_order':
      return callWithFormat(async () => (await getSec()).fetchOrder(args), F.formatOrder, name);
    case 'list_positions':
      return callPaginatedWithFormat((await getSec()).listPositions(args), F.formatPosition, name);
    case 'list_closed_positions':
      return callPaginatedWithFormat((await getSec()).listClosedPositions?.(args) ?? Promise.resolve({ items: [] }), F.formatClosedPosition, name);
    case 'fetch_portfolio_value':
      return callWithFormat(async () => (await getSec()).fetchPortfolioValue(), F.formatPortfolioValue, name);
    case 'list_activity':
      return callPaginatedWithFormat((await getSec()).listActivity(args), F.formatActivity, name);
    case 'list_account_trades':
      return callPaginatedWithFormat((await getSec()).listAccountTrades(args), F.formatTrade, name);
    case 'setup_trading_approvals': {
      try {
        const h = await (await getSec()).setupTradingApprovals();
        const card = await F.formatTransactionHandle(h);
        return { content: [{ type: 'text' as const, text: JSON.stringify(card, (_k, v) => (typeof v === 'bigint' ? v.toString() : v), 2) }] };
      } catch (error: any) {
        return { isError: true, content: [{ type: 'text' as const, text: `Error in setup_trading_approvals: ${error?.message || String(error)}` }] };
      }
    }
    case 'split_position': {
      try {
        const h = await (await getSec()).splitPosition(args);
        const card = await F.formatTransactionHandle(h);
        return { content: [{ type: 'text' as const, text: JSON.stringify(card, (_k, v) => (typeof v === 'bigint' ? v.toString() : v), 2) }] };
      } catch (error: any) {
        return { isError: true, content: [{ type: 'text' as const, text: `Error in split_position: ${error?.message || String(error)}` }] };
      }
    }
    case 'merge_positions': {
      try {
        const h = await (await getSec()).mergePositions(args);
        const card = await F.formatTransactionHandle(h);
        return { content: [{ type: 'text' as const, text: JSON.stringify(card, (_k, v) => (typeof v === 'bigint' ? v.toString() : v), 2) }] };
      } catch (error: any) {
        return { isError: true, content: [{ type: 'text' as const, text: `Error in merge_positions: ${error?.message || String(error)}` }] };
      }
    }
    case 'redeem_positions': {
      try {
        const h = await (await getSec()).redeemPositions(args);
        const card = await F.formatTransactionHandle(h);
        return { content: [{ type: 'text' as const, text: JSON.stringify(card, (_k, v) => (typeof v === 'bigint' ? v.toString() : v), 2) }] };
      } catch (error: any) {
        return { isError: true, content: [{ type: 'text' as const, text: `Error in redeem_positions: ${error?.message || String(error)}` }] };
      }
    }

    // === Leaderboards + Public Profiles ===
    case 'list_builder_leaderboard':
      return callPaginatedWithFormat(pub.listBuilderLeaderboard(args), F.formatLeaderboardEntry, name);
    case 'list_trader_leaderboard':
      return callPaginatedWithFormat(pub.listTraderLeaderboard(args), F.formatTraderLeaderboardEntry, name);
    case 'fetch_public_profile':
      return callWithFormat(() => pub.fetchPublicProfile(args), F.formatPublicProfile, name);

    // === Reward Tracking (viewing only) ===
    case 'list_current_rewards':
      return callPaginatedWithFormat(pub.listCurrentRewards(args), F.formatCurrentReward, name);
    case 'list_market_rewards':
      return callPaginatedWithFormat(pub.listMarketRewards(args), F.formatMarketReward, name);
    case 'fetch_reward_percentages':
      return callWithFormat(async () => (await getSec()).fetchRewardPercentages(), F.formatRewardsPercentages, name);
    case 'list_user_earnings_and_markets_config':
      return callPaginatedWithFormat((await getSec()).listUserEarningsAndMarketsConfig(args), F.formatUserRewardsEarning, name);

    // === Additional Analytics ===
    case 'list_builder_trades':
      return callPaginatedWithFormat(pub.listBuilderTrades(args), F.formatBuilderTrade, name);
    case 'fetch_builder_volume':
      return callWithFormat(() => pub.fetchBuilderVolume(args), F.formatBuilderVolume, name);

    // === Additional Rewards (secure) ===
    case 'fetch_order_scoring':
      return callWithFormat(async () => (await getSec()).fetchOrderScoring(args), F.formatOrderScoring, name);
    case 'fetch_orders_scoring':
      return callWithFormat(async () => (await getSec()).fetchOrdersScoring(args), F.formatOrderScoring, name);
    case 'list_user_earnings_for_day':
      return callPaginatedWithFormat((await getSec()).listUserEarningsForDay(args), F.formatUserRewardsEarning, name);
    case 'fetch_total_earnings_for_user_for_day':
      return callWithFormat(async () => (await getSec()).fetchTotalEarningsForUserForDay(args), F.formatGeneric, name);

    // === Additional Discovery ===
    case 'list_tags':
      return callPaginatedWithFormat(pub.listTags(args), F.formatTag, name);
    case 'fetch_tag':
      return callWithFormat(() => pub.fetchTag(args), F.formatTag, name);
    case 'fetch_related_tags':
      return callWithFormat(() => pub.fetchRelatedTags(args), F.formatGeneric, name);
    case 'list_series':
      return callPaginatedWithFormat(pub.listSeries(args), F.formatSeries, name);
    case 'fetch_series':
      return callWithFormat(() => pub.fetchSeries(args), F.formatSeries, name);

    // === Data Enhancements ===
    case 'list_market_holders':
      return callWithFormat(() => pub.listMarketHolders(args), F.formatGeneric, name); // can improve later
    case 'list_open_interest':
      return callWithFormat(() => pub.listOpenInterest(args), F.formatGeneric, name);
    case 'fetch_event_live_volume':
      return callWithFormat(() => pub.fetchEventLiveVolume(args), F.formatGeneric, name);

    // === Account / Wallet ===
    case 'fetch_notifications':
      return callWithFormat(async () => (await getSec()).fetchNotifications(), F.formatGeneric, name);
    case 'drop_notifications':
      return callWithFormat(async () => (await getSec()).dropNotifications(args), F.formatGeneric, name);
    case 'fetch_closed_only_mode':
      return callWithFormat(async () => (await getSec()).fetchClosedOnlyMode(), F.formatGeneric, name);
    case 'is_gasless_ready':
      return callWithFormat(async () => (await getSec()).isGaslessReady(), F.formatGeneric, name);

    default:
      return {
        isError: true,
        content: [{ type: 'text', text: `Unknown tool: ${name}` }]
      };
  }
});

// ==================== MCP RESOURCES (Live Subscriptions) ====================
// This completes the "subscribe" capability using the proper MCP Resources model.
// Agents can list resources, read snapshots (always clean formatted cards),
// and subscribe for push notifications/resources/updated when underlying WS data changes.

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return resourceManager.listResources();
});

server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
  return resourceManager.listResourceTemplates();
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  try {
    const uri = request.params.uri;
    const result = await resourceManager.readResource(uri);
    return result;
  } catch (error: any) {
    return {
      isError: true,
      contents: [],
      _meta: { error: `Error reading resource: ${error?.message || String(error)}` },
    } as any;
  }
});

server.setRequestHandler(SubscribeRequestSchema, async (request) => {
  try {
    await resourceManager.subscribe(request.params.uri);
    return {}; // success — empty result per spec
  } catch (error: any) {
    return {
      isError: true,
      message: `Subscribe failed: ${error?.message || String(error)}`,
    } as any;
  }
});

server.setRequestHandler(UnsubscribeRequestSchema, async (request) => {
  try {
    await resourceManager.unsubscribe(request.params.uri);
    return {};
  } catch (error: any) {
    return {
      isError: true,
      message: `Unsubscribe failed: ${error?.message || String(error)}`,
    } as any;
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Startup message only on stderr — never pollute stdout
  console.error('Polymarket MCP server listening on stdio (name=polymarket-mcp, version=1.0.0) — resources + subscriptions enabled');

  // Graceful cleanup of WebSocket subscriptions when the process exits
  const shutdown = async () => {
    try {
      await resourceManager.closeAll();
    } catch {}
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error('Fatal error starting Polymarket MCP server:', error);
  // Do not exit hard in some hosts; let the transport close naturally
});
