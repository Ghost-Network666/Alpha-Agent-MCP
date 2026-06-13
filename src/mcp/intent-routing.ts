/**
 * Deterministic intent → tool-plan routing for host LLMs.
 * Routes WHICH tools to call — never substitutes numeric trade params (no trading-by-intent).
 */

import type { CycleGoal, CycleStep } from '../automation/agent-cycle.js';

export type AgentIntent =
  | 'session_startup'
  | 'rewards_farm'
  | 'weather_alpha'
  | 'mispricing_flip'
  | 'trading_monitor'
  | 'discovery_scan'
  | 'check_orderbook'
  | 'check_spread'
  | 'check_farmability'
  | 'alpha_scan'
  | 'place_reward_maker'
  | 'place_limit_explicit'
  | 'rotate_after_failure'
  | 'sentiment_alpha'
  | 'x_sentiment_fusion'
  | 'contradiction_check'
  | 'research_first'
  | 'signals_to_execution'
  | 'resource_heartbeat'
  | 'heartbeat_locked_autonomy'
  // New granular research intents for narrow single-mandate tools (host orchestrates "swarm" via these + direct calls on heartbeat)
  | 'research_liquidity'
  | 'research_competition'
  | 'research_divergence'
  | 'research_reward_farmability'
  | 'research_fusion'
  // Explicit on/off for the strict per-tick agent lock (strategyLock). Off by default. Host (Hermes/OpenClaw) controls via these.
  | 'enable_locked_autonomy'
  | 'disable_locked_autonomy'
  // Completeness gate intents — every native MCP tool (public + secure + intelligence + strategy + advanced + meta) must be reachable via route_agent_intent plans.
  // This ensures consuming agents (Hermes/OpenClaw) can route to 100% of the surface through deterministic intent language without ever guessing tool names, sequences, or "what next?".
  | 'meta_introspection_full'
  | 'discovery_full'
  | 'market_data_deep'
  | 'taxonomy_resources'
  | 'sports_series_teams'
  | 'public_leaderboards_profiles'
  | 'comments_social'
  | 'rewards_earnings_full'
  | 'portfolio_activity_full'
  | 'trading_cancels_management'
  | 'onchain_ctf_workflows'
  | 'gasless_prepare_all'
  | 'advanced_account_wallet'
  | 'strategy_sizing_complete'
  | 'weather_complete'
  | 'automation_orchestration';

export type IntentRouteRequest = {
  intent?: AgentIntent; // optional when naturalLanguage is provided for built-in NLR classification
  naturalLanguage?: string; // Raw user/agent NL goal. When provided (and no strong explicit intent), the router performs lightweight heuristic classification to resolve intent + confidence. No LLM call.
  topic?: string;
  tokenId?: string;
  market?: string;
  slug?: string;
  maxMinCostUsd?: number;
  goal?: CycleGoal;
  strategies?: Record<string, unknown>;
  lockedStrategyKey?: string; // Composite e.g. "weather:low", "politics:high" — locks the plan to one per-market/per-volume strategy
  heartbeat?: boolean; // When true (or with lockedStrategyKey for autonomous flows), planners produce complete plans that include send_heartbeat as first step for host to call on its heartbeat/resource events.
  externalSignals?: any[]; // Optional host-provided (x_search, on-chain analytics, etc.) for narrow research fusion steps
};

/** MCP tool name → SDK README method (confirm via the canonical URL https://github.com/Polymarket/ts-sdk/blob/main/README.md linked in mcp_llms_full_guide prompt before first use). */
export const MCP_TO_SDK_METHOD: Record<string, string> = {
  place_limit_order: 'placeLimitOrder',
  place_optimized_reward_order: 'placeLimitOrder (postOnly GTC via MCP wrapper)',
  place_market_order: 'placeMarketOrder',
  get_order_book: 'getOrderBook',
  get_spread: 'getSpread',
  fetch_market: 'listMarkets({ clobTokenIds }) — fetchMarket has no tokenId',
  discover_topic: 'listEvents + listMarkets (tagSlug/tagId)',
  list_active_maker_reward_markets: 'listCurrentRewards + listMarkets enrichment',
  get_farmability: 'getOrderBook + listMarketRewards / mids',
  post_orders: 'postOrders',
};

export type IntentRoutePlan = {
  success: boolean;
  intent: AgentIntent;
  resolvedIntent?: AgentIntent; // when classification happened
  phase: 'route';
  steps: CycleStep[];
  profile?: string;
  prompts: string[];
  resources: string[];
  nextTools: string[];
  agentDirective: string;
  tradingRule: string;
  lockedStrategyKey?: string;
  priceMovementCondition?: string;
  researchSource?: string;
  // NLR / confidence fields (gap closure for Bankr-like natural language routing)
  confidence?: number; // 0-1. High when explicit intent, computed heuristic when naturalLanguage used.
  classificationMethod?: 'explicit' | 'heuristic' | 'fallback';
  matchedKeywords?: string[];
  naturalLanguage?: string; // echoed when used
  sdkAlignment: {
    readmeUrl: string;
    readmeResource?: string;
    rule: string;
    mcpToSdk: typeof MCP_TO_SDK_METHOD;
  };
  intentRegistry: typeof INTENT_REGISTRY;
  note: string;
};

export const INTENT_REGISTRY: Record<
  AgentIntent,
  { summary: string; profile?: string; primaryTools: string[] }
> = {
  session_startup: {
    summary: 'First calls every MCP session',
    primaryTools: [
      'get_agent_recipes',
      'get_strategies',
      'route_agent_intent',
      'load_agent_profile',
    ],
  },
  rewards_farm: {
    summary: 'Maker reward loop: scan → farmability → place',
    profile: 'rewards',
    primaryTools: [
      'generate_alpha_report',
      'list_active_maker_reward_markets',
      'get_farmability',
      'place_optimized_reward_order',
    ],
  },
  weather_alpha: {
    summary: 'Weather topic + forecast + explicit limit',
    profile: 'weather',
    primaryTools: ['discover_topic', 'get_uk_weather_forecast', 'alpha_report', 'place_limit_order'],
  },
  mispricing_flip: {
    summary: 'External signal vs platform price',
    profile: 'trading',
    primaryTools: ['compute_market_signals', 'get_farmability', 'place_limit_order'],
  },
  trading_monitor: {
    summary: 'Open orders, positions, balance',
    profile: 'trading',
    primaryTools: ['list_open_orders', 'list_positions', 'get_balance_allowance'],
  },
  discovery_scan: {
    summary: 'Topic/events/markets with tokenIds',
    profile: 'discovery',
    primaryTools: ['discover_topic', 'fetch_market', 'search'],
  },
  check_orderbook: {
    summary: 'CLOB depth (tier-1)',
    primaryTools: ['get_order_book'],
  },
  check_spread: {
    summary: 'Bid-ask spread (tier-1)',
    primaryTools: ['get_spread'],
  },
  check_farmability: {
    summary: 'Pre-trade reward/book snapshot',
    primaryTools: ['get_farmability'],
  },
  alpha_scan: {
    summary: 'Deterministic ranked report',
    primaryTools: ['generate_alpha_report', 'alpha_report'],
  },
  place_reward_maker: {
    summary: 'Post-only maker reward place',
    primaryTools: ['place_optimized_reward_order'],
  },
  place_limit_explicit: {
    summary: 'You supply price/size/side — SDK placeLimitOrder',
    primaryTools: ['place_limit_order'],
  },
  rotate_after_failure: {
    summary: 'Pick different market after failed place',
    primaryTools: ['list_active_maker_reward_markets', 'generate_alpha_report'],
  },
  sentiment_alpha: {
    summary: 'X/host sentiment signal to alpha/strategy (host does x_search; pass as externalSignals)',
    profile: 'automation',
    primaryTools: ['get_strategies', 'generate_alpha_report', 'update_strategy'],
  },
  x_sentiment_fusion: {
    summary: 'Host X sentiment + externalSignals fusion into alpha then strategy (no native X in MCP)',
    profile: 'automation',
    primaryTools: ['get_strategies', 'generate_alpha_report', 'update_strategy'],
  },
  contradiction_check: {
    summary: 'Detect X sentiment vs book skew/competitionSignal (via external + farmability in alpha)',
    profile: 'automation',
    primaryTools: ['get_strategies', 'generate_alpha_report', 'get_farmability'],
  },
  research_first: {
    summary: 'Research categories (External/Intelligence/Discovery) first, store signals, then execution',
    profile: 'discovery',
    primaryTools: ['get_strategies', 'get_tools_by_category', 'generate_alpha_report', 'update_strategy'],
  },
  signals_to_execution: {
    summary: 'Signals in strategy -> explicit place (after research cats)',
    profile: 'trading',
    primaryTools: ['get_strategies', 'fetch_market', 'place_limit_order'],
  },
  resource_heartbeat: {
    summary: 'Use resources + wait/heartbeat patterns for autonomy (avoid polling)',
    primaryTools: ['get_strategies', 'wait_seconds', 'list_open_orders'],
  },
  heartbeat_locked_autonomy: {
    summary: 'COMPLETE authoritative plan for Hermes (host) heartbeat-driven locked per-market:volume autonomy (when the lock is engaged). Hermes is the brain and owns the native heartbeat.md / OpenClaw CLOB liveness enforcement + primary control loop. The strict "stay locked only to this key" behavior is **off by default** and is controlled by the host (Hermes/OpenClaw) via the lock toggle (see enable/disable_locked_autonomy intents). MCP is the integration surface (planners return the full deterministic sequence the host executes on its heartbeat/resource events: send_heartbeat FIRST, get_strategies(locked composite key), research-backed intelligence feeding the locked strategy, explicit execution with numbers from the locked rules + live signals, update_strategy to persist). Always get_strategies(locked) first on the host tick; research before execution. The plan checks the strategyLock flag from the loaded strategy: if true, strict locked mode (narrow research steps + "do not deviate to other markets"); if false/off (default), the key provides signals but the host brain may freely choose other keys or behavior. lockedStrategyKey, researchSource, priceMovementCondition carried in plan + agentDirective. Use for true multi-market autonomy (e.g. weather:low, politics:high) when the host has turned the lock on for that key.',
    profile: 'automation',
    primaryTools: ['send_heartbeat', 'get_strategies', 'get_tools_by_category', 'generate_alpha_report', 'get_farmability', 'suggest_qualified_size', 'place_optimized_reward_order', 'post_orders', 'update_strategy', 'wait_seconds', 'get_mcp_usage'],
  },
  enable_locked_autonomy: {
    summary: 'Turn ON the strict per-tick locking for a composite key (sets strategyLock: true on that market:volume entry). Off by default. Hermes (host) or OpenClaw calls this to engage the full locked autonomy mode (narrow research, price movement rules from the locked strategy, "stay only on this key" enforcement) for future heartbeat-driven calls with that lockedStrategyKey. Returns confirmation and updated strategy.',
    profile: 'automation',
    primaryTools: ['get_strategies', 'update_strategy'],
  },
  disable_locked_autonomy: {
    summary: 'Turn OFF the strict per-tick locking for a composite key (sets strategyLock: false or removes the flag). Hermes (host) or OpenClaw calls this to disengage locked mode so the agent is not forced to stay on one market/volume. The key can still be used for targeted research/signals, but the host brain regains full freedom to route elsewhere. Off by default.',
    profile: 'automation',
    primaryTools: ['get_strategies', 'update_strategy'],
  },
  // Granular narrow research intents — host (Hermes) calls these (or the direct narrow tools after loading Intelligence category) on its heartbeat to achieve specialized "swarm" behavior without any internal MCP continuous agents or loops.
  research_liquidity: {
    summary: 'Narrow mandate: focused liquidity health + depth + skew for one locked market (host calls on heartbeat, persists result).',
    profile: 'automation',
    primaryTools: ['get_liquidity_health', 'update_strategy'],
  },
  research_competition: {
    summary: 'Narrow mandate: competition / adverse selection / book pressure signal for the locked key.',
    profile: 'automation',
    primaryTools: ['get_competition_signal', 'update_strategy'],
  },
  research_divergence: {
    summary: 'Narrow mandate: deterministic divergence / contradiction between prior and signal or external vs book.',
    profile: 'automation',
    primaryTools: ['compute_divergence', 'update_strategy'],
  },
  research_reward_farmability: {
    summary: 'Narrow mandate: reward program attractiveness + cost + rate snapshot for the specific token/locked key.',
    profile: 'automation',
    primaryTools: ['get_reward_farmability_snapshot', 'update_strategy'],
  },
  research_fusion: {
    summary: 'Narrow mandate: fuse host externalSignals (x_search, on-chain analytics, etc.) vs current book and return contradiction only.',
    profile: 'automation',
    primaryTools: ['analyze_signal_contradiction', 'update_strategy'],
  },

  // === Completeness intents (added to satisfy "all MCP tools have intent language routing" — no commits until 100% coverage) ===
  meta_introspection_full: {
    summary: 'Complete never-guess path for all Meta/introspection tools (categories, recipes, doctor, usage, search, load profile, route/configure). Start every deep session here or via session_startup (prompts/get mcp_llms_full_guide for SDK URL + mappings first). After any meta tool response, re-call route_agent_intent with a goal intent or get_strategies.',
    profile: 'automation',
    primaryTools: ['list_tool_categories', 'get_tools_by_category', 'get_agent_recipes', 'search_tools', 'mcp_doctor', 'get_mcp_usage', 'load_agent_profile', 'route_agent_intent', 'configure_agent_routing'],
  },
  discovery_full: {
    summary: 'Route for broad discovery surface: list_markets, fetch_market, discover_topic, search, list_events, fetch_event + all taxonomy. Use this when you need any discovery tool without guessing parameters or order.',
    profile: 'discovery',
    primaryTools: ['discover_topic', 'list_markets', 'fetch_market', 'search', 'list_events', 'fetch_event', 'list_sports', 'fetch_sports_market_types', 'list_tags', 'fetch_tag', 'list_series', 'fetch_series', 'list_teams'],
  },
  market_data_deep: {
    summary: 'All book/price/volume data tools in one deterministic plan (get_order_book, all fetch_price*/midpoint/spread, history, last_trade, list_trades, estimate, fetch_prices/order_books/midpoints/spreads, neg_risk, tick_size, execute_params, market_info, etc.). Always after get_strategies + token resolution.',
    primaryTools: ['get_order_book', 'get_spread', 'fetch_price', 'fetch_midpoint', 'fetch_price_history', 'fetch_last_trade_price', 'fetch_last_trade_prices', 'list_trades', 'estimate_market_price', 'fetch_prices', 'fetch_order_books', 'fetch_midpoints', 'fetch_spreads', 'fetch_neg_risk', 'fetch_tick_size', 'fetch_execute_params', 'fetch_market_info'],
  },
  taxonomy_resources: {
    summary: 'Taxonomy + related resources (tags, event tags, market tags, related tags/resources, market holders, open interest, event live volume).',
    primaryTools: ['fetch_event_tags', 'fetch_market_tags', 'fetch_related_tag_resources', 'fetch_related_tags', 'list_market_holders', 'list_open_interest', 'fetch_event_live_volume'],
  },
  sports_series_teams: {
    summary: 'Sports, series, teams full surface (list_sports, fetch_sports_market_types, list_series, fetch_series, list_teams and related).',
    primaryTools: ['list_sports', 'fetch_sports_market_types', 'list_series', 'fetch_series', 'list_teams'],
  },
  public_leaderboards_profiles: {
    summary: 'Public leaderboards, profiles, builder/trader volume/trades (list_builder_leaderboard, list_trader_leaderboard, fetch_public_profile, list_builder_trades, fetch_builder_volume).',
    primaryTools: ['list_builder_leaderboard', 'list_trader_leaderboard', 'fetch_public_profile', 'list_builder_trades', 'fetch_builder_volume'],
  },
  comments_social: {
    summary: 'Comments and social signals (list_comments, fetch_comment, list_comments_by_user_address). Host can fuse with externalSignals.',
    primaryTools: ['list_comments', 'fetch_comment', 'list_comments_by_user_address'],
  },
  rewards_earnings_full: {
    summary: 'All rewards/earnings viewing (list_current_rewards, list_market_rewards, fetch_reward_percentages, list_user_earnings_and_markets_config, list_market_positions).',
    profile: 'rewards',
    primaryTools: ['list_current_rewards', 'list_market_rewards', 'fetch_reward_percentages', 'list_user_earnings_and_markets_config', 'list_market_positions'],
  },
  portfolio_activity_full: {
    summary: 'Deep portfolio + history (list_positions, list_closed_positions, fetch_portfolio_value, list_activity, list_account_trades). Always combine with get_strategies for rules.',
    profile: 'trading',
    primaryTools: ['list_positions', 'list_closed_positions', 'fetch_portfolio_value', 'list_activity', 'list_account_trades'],
  },
  trading_cancels_management: {
    summary: 'Full trading session management: open orders, specific order, watch fills, all cancel variants (single, multi, all, market), post (batch), send_heartbeat. Preferred for makers: use post_orders + heartbeat.',
    profile: 'trading',
    primaryTools: ['list_open_orders', 'fetch_order', 'watch_order_until_filled', 'cancel_order', 'cancel_orders', 'cancel_all', 'cancel_market_orders', 'post_order', 'post_orders', 'send_heartbeat'],
  },
  onchain_ctf_workflows: {
    summary: 'On-chain CTF flows (split/merge/redeem positions, resolve, setup approvals, enable auto-redeem, direct approve/transfer). Requires prior setup_trading_approvals. [Requires secure client + approvals.]',
    profile: 'trading',
    primaryTools: ['setup_trading_approvals', 'enable_auto_redeem', 'split_position', 'merge_positions', 'redeem_positions', 'resolve_condition_by_token', 'approve_erc20', 'approve_erc1155_for_all', 'transfer_erc20'],
  },
  gasless_prepare_all: {
    summary: '[Advanced] All prepare_* gasless workflows (limit, market, gasless tx, split/merge/redeem, erc20/1155 approval, erc20 transfer). Only after explicit host strategy authorization + get_agent_recipes warning read. MCP never executes; returns prepared data for host to sign/send.',
    profile: 'automation',
    primaryTools: ['prepare_limit_order', 'prepare_market_order', 'prepare_gasless_transaction', 'prepare_split_position', 'prepare_merge_positions', 'prepare_redeem_positions', 'prepare_erc20_approval', 'prepare_erc1155_approval_for_all', 'prepare_erc20_transfer'],
  },
  advanced_account_wallet: {
    summary: '[Advanced] Low-level account/wallet ops (update_balance_allowance, deploy_deposit_wallet, download_accounting_snapshot, fetch_transaction, create_api_key, derive_api_key, update etc.). Strong warnings; host must authorize.',
    profile: 'automation',
    primaryTools: ['update_balance_allowance', 'deploy_deposit_wallet', 'download_accounting_snapshot', 'fetch_transaction', 'create_api_key', 'derive_api_key'],
  },
  strategy_sizing_complete: {
    summary: 'The full strategy store + helpers surface (get/set/update/clear_strategy, wait_seconds, suggest_qualified_size). Every autonomous loop starts here. Update after every research or price movement step.',
    primaryTools: ['get_strategies', 'set_strategy', 'update_strategy', 'clear_strategy', 'wait_seconds', 'suggest_qualified_size'],
  },
  weather_complete: {
    summary: 'Complete UK/global weather surface for weather markets (all three forecast/historical/current + crypto spot + integration with discover/list for mispricing).',
    profile: 'weather',
    primaryTools: ['get_uk_weather_forecast', 'get_uk_weather_historical', 'get_uk_weather_current', 'get_crypto_spot', 'discover_topic'],
  },
  automation_orchestration: {
    summary: 'High-level automation (run_agent_cycle if present, configure_agent_routing, full heartbeat_locked flows, resource patterns). Use route_agent_intent itself for most cases.',
    profile: 'automation',
    primaryTools: ['run_agent_cycle', 'configure_agent_routing', 'route_agent_intent', 'send_heartbeat', 'get_strategies'],
  },
};

/**
 * Lightweight heuristic NLR classifier (no LLM, no external calls).
 * Used by route_agent_intent when naturalLanguage is supplied.
 * Matches against intent keys, summaries, and curated aliases/keywords from the registry.
 * Returns best intent + confidence (0-1). Fallback to session_startup with low conf.
 */
export function classifyNaturalLanguageToIntent(nl: string): {
  intent: AgentIntent | null;
  confidence: number;
  method: 'heuristic' | 'fallback';
  matchedKeywords: string[];
} {
  if (!nl || typeof nl !== 'string') {
    return { intent: 'session_startup', confidence: 0.2, method: 'fallback', matchedKeywords: [] };
  }
  const text = nl.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim();
  const words = text.split(/\s+/).filter(Boolean);

  type Candidate = { intent: AgentIntent; score: number; kws: string[] };
  const candidates: Candidate[] = [];

  for (const [intentKey, reg] of Object.entries(INTENT_REGISTRY) as [AgentIntent, any][]) {
    let score = 0;
    const kws: string[] = [];

    // direct intent name match (with underscores or spaces)
    const intentName = intentKey.replace(/_/g, ' ');
    if (text.includes(intentName)) {
      score += 0.55;
      kws.push(intentName);
    }
    if (text.includes(intentKey)) {
      score += 0.55;
      kws.push(intentKey);
    }

    // summary keywords
    const summary = (reg.summary || '').toLowerCase();
    const summaryTokens = summary.split(/\W+/).filter((w: string) => w.length > 3);
    for (const tok of summaryTokens) {
      if (words.includes(tok) || text.includes(tok)) {
        score += 0.12;
        if (!kws.includes(tok)) kws.push(tok);
      }
    }

    // curated aliases for common NL phrases (expandable)
    const aliasMap: Partial<Record<AgentIntent, string[]>> = {
      rewards_farm: ['reward', 'farm', 'maker', 'lp reward', 'earn maker', 'scoring order', 'place maker'],
      weather_alpha: ['weather', 'uk weather', 'forecast', 'temperature'],
      heartbeat_locked_autonomy: ['heartbeat', 'locked', 'autonomy', 'full loop', 'autonomous', 'orchestrate'],
      session_startup: ['start', 'startup', 'begin', 'initial', 'first time', 'hello', 'new session'],
      mispricing_flip: ['misprice', 'arbitrage', 'edge', 'bayesian', 'external signal'],
      trading_monitor: ['monitor', 'positions', 'open orders', 'portfolio'],
      discovery_scan: ['discover', 'find market', 'search topic', 'list markets'],
      alpha_scan: ['alpha', 'report', 'rank', 'opportunity'],
      place_limit_explicit: ['place limit', 'explicit order', 'limit order'],
      place_reward_maker: ['place reward', 'maker order', 'optimized reward'],
    };
    const aliases = aliasMap[intentKey] || [];
    for (const a of aliases) {
      if (text.includes(a)) {
        score += 0.35;
        kws.push(a);
      }
    }

    // primary tools mention
    const prim = (reg.primaryTools || []).join(' ').toLowerCase();
    for (const w of words) {
      if (prim.includes(w) && w.length > 4) {
        score += 0.08;
      }
    }

    if (score > 0.1) {
      candidates.push({ intent: intentKey, score: Math.min(0.98, score), kws });
    }
  }

  if (candidates.length === 0) {
    return { intent: 'session_startup', confidence: 0.35, method: 'fallback', matchedKeywords: [] };
  }

  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  return {
    intent: best.intent,
    confidence: best.score,
    method: 'heuristic',
    matchedKeywords: best.kws.slice(0, 6),
  };
}

const TRADING_RULE =
  'Intent routing picks tools only. Trading requires explicit numeric price, size, and side on place_limit_order / place_optimized_reward_order — never natural-language trade intent.';

function goalFromIntent(intent: AgentIntent, req: IntentRouteRequest): CycleGoal | undefined {
  if (req.goal) return req.goal;
  const map: Partial<Record<AgentIntent, CycleGoal>> = {
    rewards_farm: 'rewards',
    weather_alpha: 'weather',
    mispricing_flip: 'mispricing',
    trading_monitor: 'trading',
    discovery_scan: 'discovery',
    alpha_scan: 'discovery',
  };
  return map[intent];
}

export function buildIntentRoute(req: IntentRouteRequest): IntentRoutePlan {
  // NL → intent classification (gap 2): if naturalLanguage provided, run heuristic classifier.
  // Explicit intent (if supplied) wins with confidence 1.0. Otherwise use classification.
  let intent: AgentIntent = req.intent as AgentIntent;
  let confidence = 1.0;
  let classificationMethod: 'explicit' | 'heuristic' | 'fallback' = 'explicit';
  let matchedKeywords: string[] = [];

  if (req.naturalLanguage && (!intent || String(req.naturalLanguage).length > 5)) {
    const cls = classifyNaturalLanguageToIntent(req.naturalLanguage);
    if (cls.intent) {
      if (!req.intent) {
        intent = cls.intent;
      }
      confidence = cls.confidence;
      classificationMethod = cls.method;
      matchedKeywords = cls.matchedKeywords;
    } else {
      confidence = cls.confidence || 0.3;
      classificationMethod = 'fallback';
    }
  }

  if (!intent) {
    intent = 'session_startup';
    confidence = Math.min(confidence, 0.4);
    classificationMethod = 'fallback';
  }

  const reg = INTENT_REGISTRY[intent];
  const steps: CycleStep[] = [];
  let order = 1;
  const tokenRef = req.tokenId
    ? { tokenId: req.tokenId }
    : req.market || req.slug
      ? { market: req.market || req.slug }
      : { tokenId: '<tokenId from prior card>' };

  const lockedStrategyKey = req.lockedStrategyKey || (req.tokenId && req.market ? `${req.tokenId}:${req.market}` : req.tokenId);
  const priceMovementCondition = 'Follow priceMovementRules + real-time mid/book from get_farmability or resources for the locked key.';
  const researchSource = intent.includes('sentiment') || intent.includes('alpha') || intent.includes('research')
    ? 'alpha_report / generate_alpha_report + externalSignals (host x_search) + farmability/competitionSignal + book health'
    : 'discover_topic + list_active_maker_reward_markets + get_farmability';

  const push = (tool: string, arguments_: Record<string, unknown>, why: string) => {
    steps.push({ order: order++, tool, arguments: arguments_, why });
  };

  // For complete intent routing in heartbeat-driven locked autonomy (user's exact wiring):
  // When lockedStrategyKey present + autonomous/heartbeat context (or explicit new intent), ensure the plan starts with send_heartbeat step for the host to call on its native heartbeat/resource notify.
  // This makes the MCP planners the source of the "complete" authoritative deterministic sequence without the MCP itself running loops (host executes the steps, per AGENTS "planners only").
  const isAutonomousHeartbeatLocked = intent === 'heartbeat_locked_autonomy' || req.heartbeat || (lockedStrategyKey && (intent.includes('rewards') || intent.includes('alpha') || intent.includes('research') || intent.includes('heartbeat') || intent.includes('autonomy')));
  if (isAutonomousHeartbeatLocked && lockedStrategyKey) {
    if (!steps.some((s) => s.tool === 'send_heartbeat')) {
      steps.unshift({
        order: 0,
        tool: 'send_heartbeat',
        arguments: {},
        why: 'Call this FIRST on host (Hermes/OpenClaw) heartbeat or resource notification (polymarket://...) to maintain CLOB session and prevent auto-cancel of resting orders before executing the locked per-market:volume strategy.',
      });
      steps.forEach((s, i) => { s.order = i + 1; });
    }
  }

  if (intent === 'session_startup') {
    
    push('get_agent_recipes', {}, 'MCP tool shapes + intentRouting registry + knownGotchas.');
    push('get_strategies', {}, 'Load or auto-seed session rules.');
    push(
      'route_agent_intent',
      { intent: 'rewards_farm' },
      'Re-call with your real intent after consulting mcp_llms_full_guide (SDK README URL) + get_agent_recipes.'
    );
  } else if (intent === 'rewards_farm') {
    push('load_agent_profile', { profile: 'rewards' }, 'Register intelligence + reward tools; re-call tools/list.');
    push('get_strategies', {}, 'Farming rules first.');
    push(
      'generate_alpha_report',
      { goal: 'rewards', maxMinCostUsd: req.maxMinCostUsd ?? 10, maxCandidates: 5 },
      'Ranked reward opportunities.'
    );
    push('get_farmability', tokenRef, 'Book + reward eligibility.');
    push(
      'suggest_qualified_size',
      { intent: 'reward_farming', ...tokenRef, side: 'BUY' },
      'Advisory size only.'
    );
    push('get_balance_allowance', { assetType: 'COLLATERAL' }, 'USDC pre-flight.');
    push('place_optimized_reward_order', { ...tokenRef, side: 'BUY' }, 'Post-only maker place.');
    push('wait_seconds', { seconds: 5, reason: 'rate discipline' }, 'CLOB place-path backoff.');
  } else if (intent === 'weather_alpha') {
    push('load_agent_profile', { profile: 'weather' }, 'Register forecast + discovery + book tools.');
    const topic = req.topic || 'weather';
    push('discover_topic', { topic, closed: false, pageSize: 15 }, 'Events + markets + tokenIds.');
    push('get_uk_weather_forecast', { city: 'London', days: 5 }, 'External reference.');
    push(
      'generate_alpha_report',
      { goal: 'weather', topic, midPriceMin: 0.45, midPriceMax: 0.55, maxCandidates: 6 },
      'Mid-band liquid scan.'
    );
    push('get_order_book', tokenRef, 'Depth before quote.');
    push(
      'place_limit_order',
      { ...tokenRef, price: 0.5, size: 5, side: 'BUY' },
      'Replace with YOUR numbers from analysis.'
    );
  } else if (intent === 'mispricing_flip') {
    push('load_agent_profile', { profile: 'trading' }, 'Register signals + full trading toolkit.');
    push('compute_market_signals', { ...tokenRef, signal: 0.55, weight: 0.4 }, 'Host supplies signal.');
    push('get_farmability', tokenRef, 'Liquidity + spread health.');
    push(
      'place_limit_order',
      { ...tokenRef, price: 0.48, size: 5, side: 'BUY' },
      'Explicit limit from your edge.'
    );
  } else if (intent === 'trading_monitor') {
    push('list_open_orders', {}, 'Resting orders.');
    push('list_positions', {}, 'Exposure.');
    push('get_balance_allowance', { assetType: 'COLLATERAL' }, 'Collateral.');
  } else if (intent === 'discovery_scan') {
    push(
      'discover_topic',
      { topic: req.topic || 'crypto', closed: false, pageSize: 20 },
      'Primary discovery.'
    );
    push('fetch_market', tokenRef, 'Full market card.');
  } else if (intent === 'check_orderbook') {
    push('get_order_book', tokenRef, 'SDK fetchOrderBook via MCP.');
  } else if (intent === 'check_spread') {
    push('get_spread', tokenRef, 'SDK fetchSpread via MCP.');
  } else if (intent === 'check_farmability') {
    push('get_farmability', tokenRef, 'Reward + book snapshot.');
  } else if (intent === 'alpha_scan') {
    push('load_agent_profile', { profile: 'automation' }, 'Register alpha_report + intelligence tools.');
    push(
      'generate_alpha_report',
      {
        goal: req.goal || 'discovery',
        topic: req.topic,
        maxMinCostUsd: req.maxMinCostUsd,
        midPriceMin: 0.45,
        midPriceMax: 0.55,
        maxCandidates: 6,
      },
      'Deterministic scan + scores.'
    );
  } else if (intent === 'place_reward_maker') {
    push('get_farmability', tokenRef, 'Confirm before place.');
    push('place_optimized_reward_order', { ...tokenRef, side: 'BUY' }, 'Maker reward path.');
  } else if (intent === 'place_limit_explicit') {
    push('get_order_book', tokenRef, 'Quote reference.');
    push(
      'place_limit_order',
      { ...tokenRef, price: 0.5, size: 5, side: 'BUY' },
      'You MUST set price/size/side from strategy — placeholders only.'
    );
  } else if (intent === 'rotate_after_failure') {
    push(
      'list_active_maker_reward_markets',
      { maxMinCostUsd: req.maxMinCostUsd ?? 10 },
      'Fresh ranked markets.'
    );
    push(
      'generate_alpha_report',
      { goal: 'rewards', maxMinCostUsd: req.maxMinCostUsd ?? 10 },
      'Alternate pick — never retry same token blindly.'
    );
  } else if (intent === 'sentiment_alpha' || intent === 'x_sentiment_fusion' || intent === 'contradiction_check') {
    push('get_strategies', {}, 'Load rules first (incl externalSignals policy).');
    push('generate_alpha_report', {
      goal: req.goal || 'discovery',
      topic: req.topic,
      externalSignals: req.strategies?.externalSignals || [], // host: use your x_search/sentiment tool, populate [{tokenId, signal: <0-1 from X sentiment>, prior?, weight?, label:'x_sentiment'}]
      maxCandidates: 6,
    }, 'HOST: perform x_search (or equiv) for topic sentiment/contradiction vs book; feed results here as externalSignals then update_strategy. Ties to competitionSignal/farmability.');
    push('update_strategy', { key: 'rules:current_sentiment', externalSignals: '<from host x + alpha>' }, 'Persist X sentiment signals to brain (strategy sacred).');
  } else if (intent === 'research_first') {
    push('get_strategies', {}, 'Rules first.');
    push('list_tool_categories', {}, 'Discover Research cats (External/Intelligence/Discovery for signals/sentiment).');
    push('get_tools_by_category', { category: 'External' }, 'Non-CLOB refs (crypto/weather).');
    push('get_tools_by_category', { category: 'Intelligence' }, 'Alpha + signals (host sentiment -> externalSignals).');
    push('get_tools_by_category', { category: 'Discovery' }, 'Topic scan.');
    push('generate_alpha_report', { goal: req.goal || 'discovery', topic: req.topic, externalSignals: [] }, 'Research signals first.');
    push('update_strategy', { key: 'signals:research', note: 'store before any Execution/Trading/Rewards' }, 'Persist research; obey: Research cats first, Execution after in strategy.');
  } else if (intent === 'signals_to_execution' || intent === 'resource_heartbeat') {
    push('get_strategies', {}, 'Load persisted signals/rules (from prior research cats).');
    push('fetch_market', tokenRef, 'Confirm with token from signals.');
    push('get_farmability', tokenRef, 'Health incl competitionSignal/sentiment proxy.');
    push('wait_seconds', { seconds: 2, reason: 'heartbeat/resource discipline (use resources for live vs poll)' }, 'Autonomy via resources + explicit wait (no timer loops).');
    push('place_limit_order', { ...tokenRef, price: '<from strategy/calc explicit>', size: '<from suggest or rules>', side: 'BUY' }, 'Explicit ONLY from strategy after research.');
  } else if (intent === 'heartbeat_locked_autonomy') {
    // The general prepend logic (above) already ensures send_heartbeat is the first step for locked/heartbeat-driven cases.
    // This branch completes the "all complete intent routing" authoritative sequence.
    // Hermes (host) brain + heartbeat.md drives; MCP is research + tools + strategy data layer only.
    // The strict "stay locked only to this key + obey its priceMovementRules exclusively" behavior is **off by default**.
    // The host (Hermes or OpenClaw) turns the lock on/off for a composite key using the enable/disable intents (or direct update_strategy).
    // Plan always loads the strategy first so the executing host can see the current strategyLock flag.
    push('get_strategies', lockedStrategyKey ? { tokenId: lockedStrategyKey } : {}, 'Load the exact locked per-market:volume strategy (volumeTier, strategyLock flag, priceMovementRules, entry/exit/sizing/drawdown, prior signals, lastPeg). ALWAYS first every host heartbeat tick. Check strategy.strategyLock after this step. (Qualifier: strategy)');
    push('get_balance_allowance', { assetType: 'COLLATERAL' }, 'USDC pre-flight qualifier for autonomous mutation guard. (Qualifier: balance)');
    push('get_order_book', tokenRef, 'Live book depth qualifier for autonomous safety block. (Qualifier: book)');
    push('get_spread', tokenRef, 'Spread health qualifier for autonomous mutation guard. (Qualifier: spread)');
    push('route_agent_intent', { intent: 'heartbeat_locked_autonomy', lockedStrategyKey: lockedStrategyKey || '<composite>', heartbeat: true }, 'Re-affirm routed plan (Qualifier: route). Heartbeat MUST only execute steps from this plan — never guess chains.');
    push('list_tool_categories', {}, 'Discover research categories (External/Intelligence/Discovery) for signals for THIS key.');
    push('get_tools_by_category', { category: 'Intelligence' }, 'Load narrow specialized research tools. Host orchestrates narrow mandates on its heartbeat — MCP never runs continuous agents.');
    // Narrow research sequence (always useful for signals on the key; the "must stay only here" is conditional on the lock flag):
    // IMPORTANT: when strategyLock===true (lock engaged), the host MUST use ONLY the narrow single-mandate Intelligence tools for research on this key (get_liquidity_health, get_competition_signal, compute_divergence, get_reward_farmability_snapshot, analyze_signal_contradiction or their research_* intents). Do NOT fall back to broad generate_alpha_report while locked.
    push('get_liquidity_health', { tokenId: tokenRef.tokenId || '<from locked>', lockedStrategyKey }, 'Narrow mandate: liquidity health + skew for this key.');
    push('update_strategy', { tokenId: lockedStrategyKey, liquidityHealth: '<from get_liquidity_health>', note: 'Persist this narrow research signal under the exact locked composite.' }, 'Persist narrow signal.');
    push('get_competition_signal', { tokenId: tokenRef.tokenId || '<from locked>', lockedStrategyKey }, 'Narrow mandate: competition / book pressure for the key.');
    push('update_strategy', { tokenId: lockedStrategyKey, competitionSignal: '<from narrow tool>', note: 'Persist narrow competition signal.' }, 'Persist after each narrow mandate.');
    push('compute_divergence', { tokenId: tokenRef.tokenId || '<from locked>', lockedStrategyKey, externalSignals: 'from host if available' }, 'Narrow contradiction / divergence step (external or prior vs book).');
    push('update_strategy', { tokenId: lockedStrategyKey, divergence: '<from narrow divergence tool>', note: 'Persist narrow fusion/contradiction result.' }, 'Host decides when to stop narrow research.');
    push('generate_alpha_report', { goal: req.goal || 'rewards', lockedStrategyKey, maxMinCostUsd: req.maxMinCostUsd ?? 10 }, 'Broader research (use only if lock off; when locked, prefer narrow tools above). Intelligence produces data only.');
    push('update_strategy', { tokenId: lockedStrategyKey, alphaSignals: '<paste relevant fields from narrow tools + any broader alpha + externalSignals here>', note: 'Feed research signals into the Hermes-managed locked strategy store entry before price movement check or execution on this heartbeat tick.' }, 'Persist combined research. Research source is SDK + host externalSignals only; MCP hosts no models.');
    push('get_farmability', tokenRef, 'LIVE real-time book (depth, spread, competitionSignal, nearMid suggestions, sentiment proxy) for price movement decision on the key.');
    push('suggest_qualified_size', { intent: 'reward_farming', ...tokenRef, lockedStrategyKey }, 'Size derived ONLY from locked strategy rules + this live farmability (CRITICAL: never use numbers from user query; always from strategy + live signals).');
    push('get_balance_allowance', { assetType: 'COLLATERAL' }, 'Pre-flight collateral for the locked execution only.');
    push('place_optimized_reward_order', { ...tokenRef, side: 'BUY', lockedStrategyKey }, 'EXPLICIT place with concrete price/size from (a) locked priceMovementRules + (b) live farmability nearMid/mid adjusted for drift + (c) suggest size. postOnly GTC for sticky. NO INTENT.');
    push('update_strategy', { tokenId: lockedStrategyKey, priceMovementCondition, lastResearchSource: researchSource, lastTick: new Date().toISOString(), note: 'persist current mid/peg, signals (including narrow ones), and any price movement state under THIS exact locked key for next heartbeat comparison' }, 'Persist real-time price movement state, signals, and updates to the single locked strategy entry Hermes owns.');
    push('get_mcp_usage', {}, 'Observability for the complete cycle on this heartbeat tick.');
  } else if (intent === 'enable_locked_autonomy') {
    push('get_strategies', lockedStrategyKey ? { tokenId: lockedStrategyKey } : {}, 'Load current strategy for the composite key.');
    push('update_strategy', { tokenId: lockedStrategyKey, strategyLock: true, note: 'Lock engaged by host. Future heartbeat calls with this lockedStrategyKey + heartbeat:true will use strict per-tick locking (narrow research + stay only on this key + obey its priceMovementRules).' }, 'Turn the agent lock ON for this key (strategyLock: true). Off by default. Host (Hermes/OpenClaw) controls this.');
    push('get_mcp_usage', {}, 'Track the lock toggle.');
  } else if (intent === 'disable_locked_autonomy') {
    push('get_strategies', lockedStrategyKey ? { tokenId: lockedStrategyKey } : {}, 'Load current strategy for the composite key.');
    push('update_strategy', { tokenId: lockedStrategyKey, strategyLock: false, note: 'Lock disengaged by host. The key can still be used for targeted research/signals on heartbeat, but the agent is no longer forced to stay exclusively on this market/volume tier. Host brain regains freedom to route to other keys.' }, 'Turn the agent lock OFF for this key (strategyLock: false or absent). This is the default state.');
    push('get_mcp_usage', {}, 'Track the lock toggle.');
  } else if (['research_liquidity', 'research_competition', 'research_divergence', 'research_reward_farmability', 'research_fusion'].includes(intent)) {
    // Explicit support for the new granular narrow research intents so route_agent_intent can be used directly for single-mandate steps on the host heartbeat.
    push('get_strategies', lockedStrategyKey ? { tokenId: lockedStrategyKey } : {}, 'Load locked rules + prior narrow signals first.');
    if (intent === 'research_liquidity') {
      push('get_liquidity_health', { tokenId: tokenRef.tokenId || '<token>', lockedStrategyKey }, 'Execute the narrow liquidity mandate.');
      push('update_strategy', { tokenId: lockedStrategyKey, liquidityHealth: '<result>', lastNarrowResearch: intent }, 'Persist this narrow research signal immediately.');
    } else if (intent === 'research_competition') {
      push('get_competition_signal', { tokenId: tokenRef.tokenId || '<token>', lockedStrategyKey }, 'Execute the narrow competition mandate.');
      push('update_strategy', { tokenId: lockedStrategyKey, competitionSignal: '<result>', lastNarrowResearch: intent }, 'Persist narrow signal.');
    } else if (intent === 'research_divergence') {
      push('compute_divergence', { tokenId: tokenRef.tokenId || '<token>', lockedStrategyKey, externalSignals: req.externalSignals || [] }, 'Execute narrow divergence / contradiction step.');
      push('update_strategy', { tokenId: lockedStrategyKey, divergence: '<result>', lastNarrowResearch: intent }, 'Persist narrow fusion result.');
    } else if (intent === 'research_reward_farmability') {
      push('get_reward_farmability_snapshot', { tokenId: tokenRef.tokenId || '<token>', lockedStrategyKey, maxMinCostUsd: req.maxMinCostUsd }, 'Execute narrow reward attractiveness mandate.');
      push('update_strategy', { tokenId: lockedStrategyKey, rewardFarmability: '<result>', lastNarrowResearch: intent }, 'Persist narrow reward signal.');
    } else if (intent === 'research_fusion') {
      push('analyze_signal_contradiction', { tokenId: tokenRef.tokenId || '<token>', lockedStrategyKey, externalSignals: req.externalSignals || [] }, 'Execute narrow external-vs-book fusion / contradiction mandate.');
      push('update_strategy', { tokenId: lockedStrategyKey, signalContradiction: '<result>', lastNarrowResearch: intent }, 'Persist narrow contradiction analysis.');
    }
    push('get_mcp_usage', {}, 'Track usage of this narrow research step.');
  }

  // === Completeness branches for the new intents (every native tool now has a deterministic route_agent_intent path + rich agentDirective + nextTools) ===
  if (intent === 'meta_introspection_full') {
    
    push('get_agent_recipes', {}, 'Source of truth for full intent registry, native tool shapes, coverage claim, and never-guess contract.');
    push('get_strategies', {}, 'Current rules / lock state / persisted signals before any introspection.');
    push('list_tool_categories', {}, 'Discover the full categorized surface (Meta, Intelligence, Discovery, Rewards, Trading, Strategy, Advanced, Weather, Automation).');
    push('get_tools_by_category', { category: 'Meta' }, 'All meta tools (recipes, doctor, categories, usage, search, load_profile, route, configure).');
    push('get_tools_by_category', { category: 'Intelligence' }, 'Narrow research + alpha tools.');
    push('mcp_doctor', {}, 'Production health, routingAlwaysOn, intelligenceRole (includes lock toggle), v2Alignment, intentCount.');
    push('get_mcp_usage', {}, 'Observability for this meta cycle.');
    push('search_tools', { query: 'cancel', limit: 5 }, 'Example keyword search across the entire surface.');
  } else if (intent === 'discovery_full') {
    
    push('get_agent_recipes', {}, 'Recipes + full routing coverage.');
    push('get_strategies', {}, 'Prefs/filters before broad scan.');
    push('load_agent_profile', { profile: 'discovery' }, 'Surface all Discovery category tools.');
    push('discover_topic', { topic: req.topic || 'crypto', closed: false, pageSize: 20 }, 'Events + markets + yes/no tokenIds for a topic.');
    push('list_markets', { active: true, pageSize: 15, rewardsMinSize: 100 }, 'Markets with filters (clobTokenIds, category, liquidityMin supported).');
    push('fetch_market', { tokenId: '<yes-or-no-token-from-prior>' }, 'Full card by tokenId (internally listMarkets clob filter).');
    push('search', { q: req.topic || 'election' }, 'Free-text across events/markets.');
    push('list_events', { category: req.topic }, 'Hierarchical events (parent/series).');
    push('list_sports', {}, 'Sports taxonomy.');
    push('list_tags', {}, 'All tags.');
    push('list_series', {}, 'Series.');
    push('get_tools_by_category', { category: 'Discovery' }, 'Ensure full Discovery surface is loaded.');
  } else if (intent === 'market_data_deep') {
    push('get_strategies', {}, 'Rules first.');
    push('fetch_market', tokenRef, 'Resolve token + metadata.');
    push('get_order_book', tokenRef, 'Full depth (bids/asks).');
    push('get_spread', tokenRef, 'Bid-ask + mid.');
    push('fetch_price', tokenRef, 'Current price.');
    push('fetch_midpoint', tokenRef, 'Mid price.');
    push('fetch_price_history', { ...tokenRef, interval: '1h' }, 'History for signal calc.');
    push('fetch_last_trade_price', tokenRef, 'Last trade.');
    push('list_trades', { ...tokenRef, limit: 20 }, 'Recent trades.');
    push('fetch_prices', { tokenIds: ['<array of tokens>'] }, 'Batch prices.');
    push('fetch_order_books', { tokenIds: ['<array>'] }, 'Batch books.');
    push('fetch_neg_risk', tokenRef, 'Neg risk flag + params.');
    push('fetch_tick_size', tokenRef, 'Tick size / min size (V2).');
    push('estimate_market_price', { ...tokenRef, side: 'BUY', amount: 100 }, 'Estimate for size.');
  } else if (intent === 'taxonomy_resources' || intent === 'sports_series_teams') {
    push('get_strategies', {}, 'Filters first.');
    push('fetch_event_tags', {}, 'Event tags.');
    push('fetch_market_tags', tokenRef, 'Market tags.');
    push('fetch_related_tags', {}, 'Related tags.');
    push('list_sports', {}, 'Sports.');
    push('list_series', {}, 'Series.');
    push('list_teams', {}, 'Teams.');
    push('fetch_related_tag_resources', {}, 'External resources.');
    push('list_market_holders', tokenRef, 'Holder distribution.');
    push('list_open_interest', {}, 'OI.');
  } else if (intent === 'public_leaderboards_profiles' || intent === 'comments_social') {
    push('get_strategies', {}, 'Rules.');
    push('list_builder_leaderboard', { limit: 10 }, 'Builder leaderboard.');
    push('list_trader_leaderboard', { limit: 10 }, 'Trader leaderboard.');
    push('fetch_public_profile', { address: '<0x...>' }, 'Public profile.');
    push('list_builder_trades', { builder: '<address>' }, 'Builder activity.');
    push('fetch_builder_volume', {}, 'Volume.');
    push('list_comments', { market: '<condition or slug>' }, 'Market comments.');
    push('fetch_comment', { id: '<commentId>' }, 'Specific comment.');
    push('list_comments_by_user_address', { address: '<0x...>' }, 'User comments.');
  } else if (intent === 'rewards_earnings_full') {
    push('load_agent_profile', { profile: 'rewards' }, 'Surface rewards tools.');
    push('get_strategies', {}, 'Farming rules + lock state.');
    push('list_current_rewards', { sponsored: false }, 'Active programs (page 50 internally).');
    push('list_market_rewards', tokenRef, 'Per-market rewards.');
    push('fetch_reward_percentages', {}, 'Your current reward % split.');
    push('list_user_earnings_and_markets_config', { date: new Date().toISOString().slice(0,10), compact: true }, 'Your earnings per market.');
    push('list_market_positions', {}, 'Positions in reward markets.');
  } else if (intent === 'portfolio_activity_full') {
    push('get_strategies', {}, 'Your position rules/exits first.');
    push('list_positions', { pageSize: 50 }, 'Current positions (with PnL via formatter).');
    push('list_closed_positions', { pageSize: 20 }, 'Resolved/closed.');
    push('fetch_portfolio_value', {}, 'Total portfolio value.');
    push('list_activity', { pageSize: 30 }, 'All activity (TRADE, REBATE, REWARD, SPLIT etc.).');
    push('list_account_trades', {}, 'Historical trades.');
    push('get_mcp_usage', {}, 'Cross with your MCP usage patterns.');
  } else if (intent === 'trading_cancels_management') {
    push('get_strategies', {}, 'Open order policy + requote rules.');
    push('send_heartbeat', {}, 'Host heartbeat first (per heartbeat.md).');
    push('list_open_orders', {}, 'Current resting (filter by market if needed).');
    push('fetch_order', { orderId: '<id>' }, 'Details on one.');
    push('watch_order_until_filled', { orderId: '<id>' }, 'Start/ensure fill watch resource.');
    push('cancel_order', { orderId: '<id>' }, 'Single cancel.');
    push('cancel_orders', { orderIds: ['<ids>'] }, 'Batch cancel.');
    push('cancel_all', {}, 'Cancel everything (careful).');
    push('cancel_market_orders', tokenRef, 'Cancel all for token/market.');
    push('post_orders', { orders: ['<array of pre-signed>'] }, 'Batch post (up to 15) — preferred for makers to avoid V2 contention.');
    push('get_mcp_usage', {}, 'Track cancel/place rates.');
  } else if (intent === 'onchain_ctf_workflows') {
    push('get_strategies', {}, 'CTF rules + size policy.');
    push('setup_trading_approvals', {}, 'Idempotent approvals (ERC20 + CTF + auto-redeem). Call before any split/merge/redeem.');
    push('enable_auto_redeem', {}, 'Explicit auto-redeem enable (delegates to approvals).');
    push('split_position', { conditionId: '<conditionId>', amount: '100' }, 'Split USDC -> outcome tokens (explicit amounts).');
    push('merge_positions', { conditionId: '<conditionId>', amount: '50' }, 'Merge back.');
    push('redeem_positions', { conditionId: '<conditionId>' }, 'Redeem resolved (or use marketId).');
    push('resolve_condition_by_token', tokenRef, 'Resolve helper.');
    push('approve_erc20', {}, 'Direct approve if needed.');
    push('get_balance_allowance', { assetType: 'COLLATERAL' }, 'Verify after on-chain ops.');
  } else if (intent === 'gasless_prepare_all' || intent === 'advanced_account_wallet') {
    push('get_agent_recipes', {}, 'Read the [Advanced] warnings and exact shapes before touching these.');
    push('get_strategies', {}, 'Advanced policy must be in your strategy (only host-authorized use).');
    push('prepare_limit_order', {}, '[Advanced] Gasless prepare limit.');
    push('prepare_market_order', {}, '[Advanced] Gasless prepare market.');
    push('prepare_gasless_transaction', {}, '[Advanced] Generic gasless tx prepare.');
    push('prepare_split_position', {}, '[Advanced] CTF split prepare.');
    push('prepare_merge_positions', {}, '[Advanced] Merge prepare.');
    push('prepare_redeem_positions', {}, '[Advanced] Redeem prepare.');
    push('prepare_erc20_approval', {}, 'ERC20 approve prepare.');
    push('prepare_erc1155_approval_for_all', {}, 'ERC1155 setApprovalForAll prepare.');
    push('prepare_erc20_transfer', {}, 'Transfer prepare.');
    push('deploy_deposit_wallet', {}, '[Advanced] Deposit wallet deploy (SDK often does auto).');
    push('create_api_key', { address: '<your EOA>', nonce: 0, signature: '<L1 sig>', timestamp: Date.now() }, '[Advanced] API key (L1 signed from EOA only).');
    push('update_balance_allowance', {}, '[Advanced] Balance/allowance update.');
    // NOTE: These return prepared data. Host (Hermes) signs/sends. MCP does not execute.
  } else if (intent === 'strategy_sizing_complete') {
    push('get_agent_recipes', {}, 'See strategy store contract.');
    push('get_strategies', {}, 'The complete current brain (all keys, including locked ones with strategyLock).');
    push('set_strategy', { tokenId: 'example:low', liquidityMin: 50000, quoteNearMid: true }, 'Full replace (use update_strategy for partials).');
    push('update_strategy', { tokenId: 'weather:low', maxRequoteRatePerSidePerSec: 8, note: 'tighten after p99 latency observation' }, 'Preferred partial update — preserves everything else under the key.');
    push('suggest_qualified_size', { intent: 'reward_farming', tokenId: '<token>', capitalUsd: 200 }, 'Size helper from live book + your rules.');
    push('wait_seconds', { seconds: 3, reason: 'After any strategy mutation or before next heartbeat tick.' }, 'Rate/heartbeat discipline.');
    push('clear_strategy', { tokenId: 'temp:key' }, 'Remove one key when no longer needed.');
  } else if (intent === 'weather_complete') {
    push('load_agent_profile', { profile: 'weather' }, 'Weather + discovery surface.');
    push('get_strategies', {}, 'Weather event prefs + mispricing thresholds.');
    push('get_uk_weather_forecast', { city: 'London', days: 7 }, 'Forecast (multi-provider fallback incl. Met Office).');
    push('get_uk_weather_historical', { city: 'Edinburgh', days: 3 }, 'Historical for backtest signals.');
    push('get_uk_weather_current', { city: 'Glasgow' }, 'Current conditions.');
    push('get_crypto_spot', { symbol: 'ETH' }, 'External spot for crypto-weather cross.');
    push('discover_topic', { topic: 'weather' }, 'Weather markets + tokenIds.');
    push('get_farmability', tokenRef, 'Liquidity on the weather market for mispricing.');
  } else if (intent === 'automation_orchestration') {
    push('get_agent_recipes', {}, 'Full recipes + the complete intent list (this proves coverage).');
    push('route_agent_intent', { intent: 'heartbeat_locked_autonomy', lockedStrategyKey: req.lockedStrategyKey || 'politics:high', heartbeat: true }, 'Self-route example for locked flows.');
    push('configure_agent_routing', { intent: 'rewards_farm', autonomousAssist: true }, 'Set active high-level intent for envelopes.');
    push('send_heartbeat', {}, 'The liveness hook the host must call on every tick.');
    push('get_strategies', { tokenId: req.lockedStrategyKey }, 'Load the locked composite for the orchestration tick.');
  }

  push('get_mcp_usage', {}, 'Session observability.');

  const goal = goalFromIntent(intent, req);
  const prompts = [
    'agent_routing',
    'never_guess_contract',
    'mcp_tool_structure_and_categories',
    goal === 'rewards' ? 'reward_farming_best_practices' : goal === 'mispricing' ? 'mispricing_quick_flips' : '',
  ].filter(Boolean);

  const resources = [
    'polymarket://sdk/readme',
    'polymarket://mcp/llms.txt',
    'polymarket://user/orders',
  ];
  if (req.tokenId) resources.push(`polymarket://market/${req.tokenId}/book`);

  const agentDirective =
    intent === 'rotate_after_failure'
      ? 'DO NOT retry the failed tokenId. Execute steps in order; pick a DIFFERENT market from list_active or alpha_report.'
      : intent === 'place_limit_explicit' || intent === 'place_reward_maker'
        ? 'Execute tools/call steps with YOUR numeric price/size. Intent does not place orders — you do.'
        : intent === 'heartbeat_locked_autonomy' || (lockedStrategyKey && req.heartbeat)
          ? `LOCK CHECK: After the get_strategies(locked) step, inspect the loaded strategy for this composite key. If strategy.strategyLock === true (the host has turned the lock on via enable_locked_autonomy or direct update_strategy), then: LOCKED TO strategyKey=${lockedStrategyKey || '<the composite key>'}. Hermes (host) is the brain and this is its heartbeat-driven loop. YOU (the agent) STAY LOCKED to this exact market/volume tier ONLY for this tick. Real-time price movement: after get_farmability, compare live mid/competitionSignal/drift against the priceMovementRules (driftThreshold, requoteOnlyOnDrift, etc.) loaded from get_strategies(locked). If condition met per rules, derive explicit price from the nearMid or adjusted mid in the farmability card + your locked entry rules, size from suggest_qualified_size, then place with the exact numbers. Research (alpha + externalSignals, preferably the narrow ones) feeds this locked key only. Execution only for this key. After place or decision, update_strategy under THIS exact key with new peg/state. Execute the steps in order. DO NOT deviate to any other market or ask the human. ${TRADING_RULE} Host (Hermes) triggers this planner on every native heartbeat tick. If strategy.strategyLock is false or absent (default = off), the lock is disengaged: use the research/signals from this key as inputs, but the host brain may freely choose other keys, broader discovery, or different routing. No hard "stay only here" enforcement.`
          : (intent.includes('_full') || intent.includes('_deep') || intent.includes('_complete') || intent.includes('taxonomy') || intent.includes('sports') || intent.includes('leader') || intent.includes('comments') || intent.includes('onchain') || intent.includes('gasless') || intent.includes('advanced_account') || intent.includes('automation_orchestration'))
            ? `COMPLETE INTENT LANGUAGE ROUTING for ${intent}. This plan gives the exact deterministic sequence of native MCP tools (every tool on the surface is covered by some intent). Execute steps in order via tools/call. After any step, re-call route_agent_intent({intent: "<next logical>"}) or get_strategies() — NEVER guess the next tool name, parameters, or sequence from descriptions or memory. Load get_agent_recipes + consult the canonical SDK README URL (https://github.com/Polymarket/ts-sdk/blob/main/README.md , as linked in mcp_llms_full_guide) early and often. ${TRADING_RULE} All native tools now have intent-language paths so agents never guess.`
            : `Intent "${intent}": execute steps in order via tools/call. DO NOT ask the human for menus. Re-call route_agent_intent for the next phase instead of guessing tools. ${TRADING_RULE}`;

  return {
    success: true,
    intent,
    resolvedIntent: intent,
    phase: 'route',
    steps,
    profile: reg.profile,
    prompts,
    resources,
    nextTools: [...new Set(steps.map((s) => s.tool))],
    agentDirective,
    tradingRule: TRADING_RULE,
    sdkAlignment: {
      readmeUrl: 'https://github.com/Polymarket/ts-sdk/blob/main/README.md',
      readmeResource: 'polymarket://sdk/readme',
      rule:
        'Before the first tools/call on a routed step, confirm the SDK README method in mcpToSdk matches get_agent_recipes inputSchema — never invent parameters.',
      mcpToSdk: MCP_TO_SDK_METHOD,
    },
    intentRegistry: INTENT_REGISTRY,
    lockedStrategyKey,
    priceMovementCondition,
    researchSource,
    // NLR enhancements (confidence gating + naturalLanguage support)
    confidence,
    classificationMethod,
    matchedKeywords,
    naturalLanguage: req.naturalLanguage,
    note: 'Deterministic routing only — host LLM runs each step in order. Re-call route_agent_intent when the goal changes. When lockedStrategyKey is present, treat the entire plan as locked to that composite (market:volume) entry from the strategy store. Always get_strategies for the exact key first. COMPLETE COVERAGE: Every native MCP tool (public, secure, intelligence, strategy, advanced, meta, weather, on-chain, cancels, prepares, etc.) appears in at least one intent plan returned by route_agent_intent (see INTENT_REGISTRY + the plans above). Agents MUST use route_agent_intent (or get_agent_recipes first) to obtain the exact sequence + agentDirective + nextTools. Never guess a tool name or parameter order from descriptions alone. This is the "all tools have intent language routing" contract.',
  };
}

/** Map legacy run_agent_cycle goal → default intent */
export function intentFromCycleGoal(goal: CycleGoal): AgentIntent {
  const m: Record<CycleGoal, AgentIntent> = {
    rewards: 'rewards_farm',
    weather: 'weather_alpha',
    mispricing: 'mispricing_flip',
    trading: 'trading_monitor',
    discovery: 'discovery_scan',
  };
  return m[goal] ?? 'discovery_scan';
}