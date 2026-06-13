/** Category matching: [Prefix] first, tight keywords second — avoids Meta/Analytics pollution. */

import type { ToolDef } from './agent-meta.js';

/** Current live full surface after load_agent_profile("full") / all categories: 110 tools (per read-only audit 2026-06-13).
 * Exact count is dynamic with SDK surface + registration. Always treat `tools/list` + `get_tools_by_category` + `mcp_doctor` as ground truth.
 * Older docs referred to ~145; reconciled to observed 110. */
export const TOOL_COUNT = 110;

/** Tools missing [Category] prefix — applied at load time in mcp.ts */
export const CATEGORY_PREFIX_BY_TOOL: Record<string, string> = {
  setup_trading_approvals: 'Account',
  is_gasless_ready: 'Account',
  fetch_closed_only_mode: 'Account',
  list_account_trades: 'Account',
  list_activity: 'Account',
  fetch_order: 'Trading',
  watch_order_until_filled: 'Trading',
  approve_erc20: 'Advanced',
  approve_erc1155_for_all: 'Advanced',
  transfer_erc20: 'Advanced',
  fetch_transaction: 'Advanced',
  resolve_condition_by_token: 'Discovery',
  fetch_event: 'Discovery',
  fetch_sports_market_types: 'Discovery',
  list_sports: 'Discovery',
  list_teams: 'Discovery',
  fetch_market_info: 'Analytics',
  fetch_neg_risk: 'Analytics',
  list_trades: 'Analytics',
  fetch_total_earnings_for_user_for_day: 'Rewards',
  fetch_reward_percentages: 'Rewards',
  list_current_rewards: 'Rewards',
  list_user_earnings_and_markets_config: 'Rewards',
  get_reward_earnings: 'Rewards',
  list_builder_leaderboard: 'Account',
  list_trader_leaderboard: 'Account',
  fetch_public_profile: 'Account',
  list_comments: 'Account',
  fetch_comment: 'Account',
  list_comments_by_user_address: 'Account',
  list_series: 'Discovery',
  fetch_series: 'Discovery',
  list_builder_trades: 'Analytics',
  fetch_builder_volume: 'Analytics',
  list_open_interest: 'Analytics',
  fetch_price: 'Analytics',
  fetch_midpoint: 'Analytics',
  fetch_price_history: 'Analytics',
  fetch_last_trade_price: 'Analytics',
  fetch_last_trade_prices: 'Analytics',
  estimate_market_price: 'Analytics',
  fetch_order_books: 'Analytics',
  fetch_midpoints: 'Analytics',
  fetch_spreads: 'Analytics',
  fetch_tick_size: 'Analytics',
  fetch_execute_params: 'Analytics',
  fetch_order_scoring: 'Rewards',
  fetch_orders_scoring: 'Rewards',
  get_order_scoring_status: 'Rewards',
  split_position: 'Trading',
  merge_positions: 'Trading',
  redeem_positions: 'Trading',
  list_market_positions: 'Account',
  account_snapshot: 'Account',
  fetch_event_live_volume: 'Analytics',
  fetch_related_tag_resources: 'Discovery',
  fetch_traded_market_count: 'Analytics',
  fetch_builder_fee_rates: 'Analytics',
  fetch_related_tags: 'Discovery',
  enable_auto_redeem: 'Account',
};

export function ensureCategoryPrefix(tool: ToolDef): ToolDef {
  const cat = CATEGORY_PREFIX_BY_TOOL[tool.name];
  if (!cat || !tool.description) return tool;
  if (/^\[[^\]]+\]/i.test(tool.description)) return tool;
  return { ...tool, description: `[${cat}] ${tool.description}` };
}

export function getToolsByCategory(
  tools: ToolDef[],
  category: string
): ToolDef[] {
  const catLower = category.toLowerCase();

  return tools.filter((t) => {
    const desc = t.description || '';
    const bracket = desc.match(/^\[([^\]]+)\]/i)?.[1]?.toLowerCase();
    if (bracket) {
      if (catLower === bracket) return true;
      if (catLower === 'data' && bracket === 'analytics') return true;
      return false;
    }

    const n = t.name;
    if (catLower === 'intelligence' && /alpha_report|generate_alpha|market_signals|route_agent_intent|liquidity_health|competition_signal|divergence|reward_farmability_snapshot|signal_contradiction/.test(n)) return true;
    if ((catLower === 'intelligence' || catLower === 'sentiment') && /alpha_report|generate_alpha|market_signals|compute.*signal|external|contradiction|liquidity_health|competition_signal|divergence|reward_farmability|signal_contradiction/.test(n)) return true; // Sentiment alias -> Intelligence for X sentiment/contradiction flows; use get_tools_by_category("Sentiment") or "Intelligence" (may surface 0+ if no exact prefix match, falls to keyword)
    if (catLower === 'external' && /crypto_spot|uk_weather|get_weather/.test(n)) return true;
    if (catLower === 'rewards' && /list_active_maker|farmability|maker_reward|optimized_reward|list_current_rewards|fetch_reward|list_user_earnings|reward_earnings|order_scoring|get_order_scoring/.test(n)) return true;
    if (catLower === 'trading' && /place_limit|place_market|cancel_|post_order|split_position|merge_position|redeem_position|get_order_book|get_spread|fetch_order(?!_books)|watch_order|list_open_orders|send_heartbeat/.test(n)) return true;
    if (catLower === 'discovery' && /discover_topic|fetch_market|list_market|list_event|fetch_event|search|list_tag|list_sport|list_series|fetch_series|list_teams|resolve_condition|list_tags/.test(n)) return true;
    if (catLower === 'account' && /balance|allowance|portfolio|position|notification|setup_trading|gasless_ready|closed_only|list_activity|list_account_trades|fetch_order|list_market_positions|profile|leaderboard|comment|public_profile/.test(n)) return true;
    if (catLower === 'advanced' && /approve_|transfer_erc|prepare_|sign_|send_transaction|deploy_|api_key|heartbeat|end_authentication/.test(n)) return true;
    if (catLower === 'utilities' && /wait_seconds|suggest_qualified/.test(n)) return true;
    if (catLower === 'meta' && /list_tool_categories|get_tools_by_category|get_mcp_usage|get_agent_recipes|search_tools|load_agent_profile|run_agent_cycle|route_agent_intent|configure_agent_routing|mcp_surface_doctor/.test(n)) return true;
    if (catLower === 'resources' && /watch_order|send_heartbeat/.test(n)) return true;
    if (catLower === 'analytics' && /fetch_price|fetch_midpoint|fetch.*price|estimate_market|fetch_order_books|fetch_tick|fetch_execute|fetch_spreads|fetch_midpoints|fetch_neg|list_trades|fetch_builder|fetch_traded|list_open_interest|fetch_event_live|fetch_market_info/.test(n)) return true;
    return false;
  });
}

// === Tool Role Classification (per agent safety contract) ===
// Intelligence: read/research only. Produce signals/cards for update_strategy only. Never mutate positions/orders/wallet.
export const INTELLIGENCE_READONLY_TOOLS = new Set([
  'compute_market_signals', 'generate_alpha_report', 'alpha_report', 'rank_market_opportunities',
  'get_liquidity_health', 'get_competition_signal', 'compute_divergence', 'get_reward_farmability_snapshot',
  'analyze_signal_contradiction', 'get_farmability'
]);

// Strategy: persist agent policy/signals/rules (the supporting bag; Hermes owns brain). Safe writes for state.
export const STRATEGY_PERSIST_TOOLS = new Set([
  'get_strategies', 'set_strategy', 'update_strategy', 'clear_strategy'
]);

// Trading: contains both read (book/spread/orders) and dangerous mutation (place/cancel/position mut).
export const TRADING_READ_TOOLS = new Set([
  'get_order_book', 'get_spread', 'list_open_orders', 'fetch_order', 'list_positions', 'get_balance_allowance',
  'fetch_midpoint', 'fetch_price', 'watch_order_until_filled', 'list_account_trades'
]);
export const TRADING_MUTATION_TOOLS = new Set([
  'place_limit_order', 'place_market_order', 'place_optimized_reward_order', 'place_maker_reward_order',
  'cancel_order', 'cancel_orders', 'cancel_all_orders', 'cancel_market_orders', 'post_order', 'post_orders',
  'split_position', 'merge_positions', 'redeem_positions'
]);

// Account: mix of safe reads (positions/balance/profile view) with dangerous account/API/profile actions.
export const ACCOUNT_READ_TOOLS = new Set([
  'get_balance_allowance', 'list_positions', 'list_closed_positions', 'fetch_portfolio_value', 'list_activity',
  'get_profile', 'fetch_public_profile', 'list_builder_leaderboard', 'list_trader_leaderboard', 'fetch_notifications'
]);
export const ACCOUNT_DANGEROUS_TOOLS = new Set([
  'update_profile', 'post_comment', 'drop_notifications', 'update_balance_allowance',
  'create_builder_api_key', 'revoke_builder_api_key' // plus Advanced API keys below
]);

// Advanced: high-risk — approvals, transfers, signatures, tx submit, API key mutation, prepares, deploy.
export const ADVANCED_HIGH_RISK_TOOLS = new Set([
  'approve_erc20', 'approve_erc1155_for_all', 'transfer_erc20',
  'sign_message', 'sign_typed_data', 'send_transaction',
  'create_api_key', 'derive_api_key', 'create_or_derive_api_key', 'delete_api_key',
  'prepare_limit_order', 'prepare_market_order', 'prepare_gasless_transaction',
  'prepare_split_position', 'prepare_merge_positions', 'prepare_redeem_positions',
  'prepare_erc20_approval', 'prepare_erc1155_approval_for_all', 'prepare_erc20_transfer',
  'deploy_deposit_wallet', 'download_accounting_snapshot', 'update_balance_allowance',
  'fetch_deposit_wallet'
]);

export function getToolRole(name: string): string {
  if (INTELLIGENCE_READONLY_TOOLS.has(name)) return 'Intelligence (read/research only)';
  if (STRATEGY_PERSIST_TOOLS.has(name)) return 'Strategy (persist policy/signals)';
  if (TRADING_MUTATION_TOOLS.has(name)) return 'Trading (mutation - dangerous)';
  if (TRADING_READ_TOOLS.has(name)) return 'Trading (read)';
  if (ACCOUNT_DANGEROUS_TOOLS.has(name)) return 'Account (dangerous action)';
  if (ACCOUNT_READ_TOOLS.has(name)) return 'Account (read)';
  if (ADVANCED_HIGH_RISK_TOOLS.has(name)) return 'Advanced (high-risk: sigs/approvals/transfers/tx/apikeys)';
  if (name === 'send_heartbeat') return 'Heartbeat (liveness hook; host calls on its native heartbeat.md ticks)';
  return 'Other';
}

export function isMutationTool(name: string): boolean {
  return TRADING_MUTATION_TOOLS.has(name) || ADVANCED_HIGH_RISK_TOOLS.has(name) || ACCOUNT_DANGEROUS_TOOLS.has(name);
}

export function isHighRiskAdvanced(name: string): boolean {
  return ADVANCED_HIGH_RISK_TOOLS.has(name);
}

/** mcp_surface_doctor support: builds a coverage report so route plans never name unexposed tools. */
export function buildSurfaceCoverageReport(allSourceTools: ToolDef[], exposedNames: Set<string>, intentRegistry: Record<string, { primaryTools?: string[] }>) {
  const sourceNames = new Set(allSourceTools.map(t => t.name));
  const missingInSource = Array.from(exposedNames).filter(n => !sourceNames.has(n));
  const notExposed: string[] = [];
  const perIntentIssues: Record<string, string[]> = {};

  // Walk intents and their primaryTools (and we know buildIntentRoute adds more steps)
  for (const [intent, reg] of Object.entries(intentRegistry || {})) {
    const toolsInPlan = new Set(reg.primaryTools || []);
    const issues: string[] = [];
    for (const t of toolsInPlan) {
      if (!exposedNames.has(t) && sourceNames.has(t)) {
        issues.push(t);
        if (!notExposed.includes(t)) notExposed.push(t);
      }
    }
    if (issues.length) perIntentIssues[intent] = issues;
  }

  const exposedCount = exposedNames.size;
  const sourceCount = sourceNames.size;
  const coverageOk = notExposed.length === 0 && missingInSource.length === 0;

  return {
    ok: coverageOk,
    exposedCount,
    sourceCount,
    notExposedInRoutes: notExposed.sort(),
    missingFromSourceButExposed: missingInSource,
    perIntentMissing: perIntentIssues,
    note: coverageOk
      ? 'All routed tools are exposed after full profile/category load. Heartbeat plans are safe.'
      : 'Some route steps reference tools that would not be visible without explicit category load. Run load_agent_profile("full") or get_tools_by_category for the needed cats, then re-list.',
    recommendation: 'Add missing to CATEGORY_PREFIX_BY_TOOL or improve regexes in getToolsByCategory. Rebuild + reload MCP. Re-audit with mcp_surface_doctor.'
  };
}