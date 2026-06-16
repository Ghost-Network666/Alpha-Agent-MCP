/**
 * Call-time agent routing prompt — native SDK paths + complete exposure ladder.
 */

import { buildKnownGotchasMarkdown } from './agent-gotchas.js';
import { AGENT_PROFILES } from './agent-meta.js';

export function buildAgentRoutingPrompt(): string {
  const profiles = Object.entries(AGENT_PROFILES)
    .map(([k, v]) => `  - ${k}: advisory (all tools already in tools/list flat; used for optional strategy seeding) — ${v.description}`)
    .join('\n');

  return `AGENT ROUTING — NATIVE MCP (READ FIRST, NEVER GUESS)

## Native contract (NL routing layer removed)
- SDK only (@polymarket/client). No direct HTTP. Formatted cards only.
- No server-side NL parsing, no route_agent_intent, no proprietary routing layer or central agentDirective injection on responses.
- Agents use tools/list to discover the full surface (flat complete: every SDK function wrapper + meta is listed from startup with no load/get_tools_by_category required), then tools/call with the exact tool name and arguments. The agent (LLM) decides which tool to call and in what order based on the list and descriptions.
- Obey guidance in responses where helpful. Do NOT ask the human for option menus.

## Mandatory startup (every session)
1. consult mcp_llms_full_guide prompt (links canonical SDK README URL)
2. prompts/get never_guess_contract + agent_routing
3. Call get_agent_recipes + get_strategies
4. Use tools/list (search_tools or get_tools_by_category are optional conveniences for filtered views — not prerequisites), then tools/call directly by name+args. All tools visible immediately.

## Discovery (PRIMARY now)
- tools/list — returns the COMPLETE flat list of all tools (no tiers)
- get_agent_recipes — registry + direct call examples + gotchas
- search_tools({ query }) — find by name/desc (convenience)
- get_tools_by_category — filtered view (convenience; no gating)
- tools/list (once) is sufficient

Profiles (advisory bundles):
${profiles}

## Complete surface
tools/list returns every registered tool (90+). Agent calls any directly. No "expansion" or re-list needed for access.

## Token lookup
fetch_market({ tokenId }) — listMarkets clob filter internally.

## Live data
polymarket://market/{tokenId}/book, polymarket://user/orders

${buildKnownGotchasMarkdown()}

Base SDK: https://github.com/Polymarket/ts-sdk/blob/main/README.md
`;
}
