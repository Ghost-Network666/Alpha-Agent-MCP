import { TIER1_CORE_TOOL_NAMES } from './agent-meta.js';
import { MCP_CATEGORIES } from './llms-guide.js';

/** Authoritative never-guess contract (prompts/get). */
export function buildNeverGuessPrompt(): string {
  const tier1 = TIER1_CORE_TOOL_NAMES.map((t) => `  - ${t}`).join('\n');
  const cats = MCP_CATEGORIES.join(', ');

  return `NEVER GUESS CONTRACT — MANDATORY FOR EVERY SESSION

## 0. Absolute rules
- DO NOT ask the human for "next steps" or option menus.
- DO NOT invent tool names or JSON argument shapes.
- DO NOT use natural-language "intent" for trading — always explicit price/size/side.
- Obey every agentDirective in tool responses.

## 1. First calls (in order)
1. tools/call get_agent_recipes
2. tools/call fetch_sdk_readme OR read_resource polymarket://sdk/readme (live upstream SDK docs)
3. prompts/get agent_routing
4. prompts/get mcp_tool_structure_and_categories
5. prompts/get mcp_llms_full_guide
6. tools/call get_strategies
7. tools/call run_agent_cycle({ goal: "<rewards|weather|mispricing|trading>" }) — deterministic step plan; YOU execute each step

## 2. Tier-1 tools (always in tools/list — compact descriptions)
${tier1}

Full native surface: load via get_tools_by_category or load_agent_profile. Categories: ${cats}.

## 3. Live docs (not stale committed .md)
- polymarket://sdk/readme — upstream TS SDK README (HTTP fetch, cached)
- polymarket://mcp/llms.txt — MCP mappings overlay + optional live SDK attach
- tools/call fetch_sdk_readme — same SDK text as JSON for hosts without resources

## 4. Live WebSocket resources (prefer over polling)
- polymarket://market/{tokenId}/book — subscribe for book updates
- polymarket://user/orders | positions | activity | portfolio
- polymarket://order/{orderId}/fill-status — fill watch after place

## 5. External reference data (native, no LLM in MCP)
- get_uk_weather_forecast / get_crypto_spot — host compares vs market prices
- generate_alpha_report — deterministic scan+rank+directive

## 6. Automation
- run_agent_cycle — returns ordered tools/call steps (stdio-safe; MCP does not block in a server loop)
- run_autonomous_trading_cycle — NOT registered (by design); use run_agent_cycle + strategy store

## 7. Strategy brain
- get_strategies first every loop; update_strategy for partial changes
- Persisted to logs/agent-strategy.json when MCP_STRATEGY_PATH or default logs/ path is writable

## 8. On failure (rewards)
IMMEDIATELY: generate_alpha_report or list_active_maker_reward_markets → pick DIFFERENT tokenId → place again. Never retry same token blindly.
`;
}