import type { ToolDef } from './agent-meta.js';

const MAX_DESC = 180;

/** Ultra-short overrides — full guidance lives in prompts/resources/recipes. */
const SHORT: Record<string, string> = {
  list_tool_categories: '[Meta] List categories. Default tools/list is tier-1 only; load more via get_tools_by_category.',
  get_tools_by_category: '[Meta] Register + return one category. Re-call tools/list after.',
  get_mcp_usage: '[Meta] MCP tool-call stats (this server session).',
  get_agent_recipes: '[Meta] START: exact tool names + JSON args for common flows.',
  search_tools: '[Meta] Find tools by keyword (name|summary|schema).',
  load_agent_profile: '[Meta] Register profile bundle: weather|rewards|trading|discovery|account|full.',
  fetch_sdk_readme: '[Meta] Live upstream TS SDK README (cached). Primary SDK docs on demand.',
  discover_topic: '[Discovery] Events + markets for topic (weather, sports, crypto…). Includes tokenIds.',
  fetch_market: '[Discovery] Market by id|slug|url|tokenId (tokenId via listMarkets filter).',
  list_active_maker_reward_markets: '[Rewards] Ranked reward markets (tokenIds, cost, mids). maxMinCostUsd for small cap.',
  get_farmability: '[Rewards] Pre-trade book + reward rules snapshot and score.',
  generate_alpha_report: '[Intelligence] One-call scan+rank+directive (deterministic). Host LLM acts next.',
  compute_market_signals: '[Intelligence] Farmability + optional Bayesian edge for one tokenId.',
  rank_market_opportunities: '[Intelligence] Rank tokenIds or reward scan by composite score.',
  run_agent_cycle: '[Meta] Deterministic next-step plan from goal + strategy (no server LLM). Host executes steps.',
  run_autonomous_trading_cycle: '[Meta] Alias of run_agent_cycle — deterministic automation plan.',
  get_strategies: '[Strategy] Load all persisted rules (call first every loop).',
  set_strategy: '[Strategy] Create/replace strategy entry (any key, extra fields kept).',
  update_strategy: '[Strategy] Partial merge into existing entry.',
  clear_strategy: '[Strategy] Remove one key or all.',
  place_limit_order: '[Trading] Explicit GTC limit (price, size, side). No intent.',
  place_maker_reward_order: '[Rewards] Post-only GTC maker order for reward scoring.',
  place_optimized_reward_order: '[Rewards] Suggest→validate→place maker reward order.',
  wait_seconds: '[Utilities] Server-side backoff (rate discipline).',
  suggest_qualified_size: '[Utilities] Advisory size from intent + reward rules.',
  compute_bayesian_update: '[Utilities] Bayesian prior+signal blend (host supplies signal).',
  get_crypto_spot: '[External] Public crypto USD spot (reference for mispricing).',
  get_uk_weather_forecast: '[Weather] UK forecast (multi-provider fallback).',
};

export function compactTool(tool: ToolDef): ToolDef {
  const short = SHORT[tool.name];
  if (short) return { ...tool, description: short };

  const desc = tool.description || '';
  const prefix = desc.match(/^\[[^\]]+\]/)?.[0] || '';
  const body = desc.replace(/^\[[^\]]+\]\s*/, '').trim();
  const firstSentence = body.split(/(?<=[.!?])\s+/)[0] || body;
  let compact = prefix ? `${prefix} ${firstSentence}` : firstSentence;
  if (compact.length > MAX_DESC) compact = compact.slice(0, MAX_DESC - 3) + '...';
  return { ...tool, description: compact };
}

export function compactTools(tools: ToolDef[]): ToolDef[] {
  return tools.map(compactTool);
}