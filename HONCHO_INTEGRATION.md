# Honcho Integration for AlphaMCP Agent

Honcho provides long-term memory and dialectic reasoning for the agent. Combined with the MCP's categorized tools, strategy storage, and advisory helpers (suggest_qualified_size, get_farmability, compute_bayesian_update), it enables fully autonomous operation for:

- Reward farming (maker orders sized to actual program requirements)
- Quick mispricing flips (using Bayesian signals + farmability checks)
- Persistent tracking of X intelligence, strategies, performance

## Recommended Config

See `honcho-recommended-config.json` in the project root. Key upgrades from default:

- `dialecticReasoningLevel`: "high" (better reasoning on when to farm vs flip, how to interpret signals)
- `dialecticMaxChars`: 4096 (allows storing full tool outputs, market analyses, X posts without truncation; 950GB SSD has plenty of room)
- Storage paths pointed to large SSD for vectors and DB
- Dedicated workspaces for separation of concerns (reward-farming, mispricing-flips, x-intel)
- Integration notes for MCP tools (store summaries of get_farmability results, Bayesian calculations, strategy updates)

Copy/adapt to your `~/.honcho/config.json` and `honcho-self-hosted/honcho-config.json`.

## How the Agent Should Use It With MCP

1. **Start with categories** (to avoid tool bloat):
   - Call `list_tool_categories`
   - Then `get_tools_by_category("Rewards")` or "Strategy" etc. as needed.

2. **Before any placement**:
   - Use `get_farmability(tokenId)` for real-time reward rules + current conditions.
   - Use `suggest_qualified_size` with correct `intent` ("reward_farming" for makers, "market_taker" for takers).
   - Store the plan: `set_strategy` with entry, TP, SL, notes.

3. **For mispricing / quick flips**:
   - Gather signals (X searches via external, or research).
   - Use `compute_bayesian_update` (prior = Polymarket price, signal = external estimate).
   - Check `get_farmability` for liquidity/edge.
   - Use `suggest_qualified_size` with "quick_flip" + highConfidenceEdge only for strong cases.

4. **Memory workflow with Honcho**:
   - After key MCP calls (get_farmability, suggest_qualified_size, successful placements), store summaries in Honcho under the appropriate workspace.
   - Use dialectic reasoning (higher level) to reflect on past performance: "Why did this reward farm succeed? What was the actual vs expected cost?"
   - Recall from Honcho before new decisions: "Similar market last week had farmability 85 and gave good rewards."
   - This keeps the agent's context clean while having rich long-term memory.

5. **Rate limits & autonomy**:
   - Use `wait_seconds` for backoffs.
   - Never ask human for next steps — use the `agentDirective` fields from tools + your stored strategies + Honcho memory.
   - For no opportunities: call `wait_seconds` with reason, then re-check via `list_active_maker_reward_markets` or `get_farmability`.

## Storage Paths (SSD Optimized)
Point everything to your large SSD to avoid filling the OS drive. Example mounts:
- /mnt/large-ssd/honcho/db
- /mnt/large-ssd/honcho/vectors

## Workspaces Strategy
- "Alpha" (default): general
- "polymarket-reward-farming": all reward-related memories
- "polymarket-mispricing-flips": flip analyses and outcomes
- "polymarket-x-intel": X posts, announcements, strategy discussions

This separation makes retrieval precise and prevents context pollution.

## MCP Tools to Prioritize in Honcho
- get_farmability (core signal)
- suggest_qualified_size (sizing decisions)
- compute_bayesian_update (mispricing)
- set_strategy / get_strategies (persistent plans)
- list_active_maker_reward_markets (opportunity discovery)
- wait_seconds (discipline)

Store structured summaries after each use.

## Example Honcho Query for Agent
"Recall from polymarket-reward-farming: markets with farmability >70 and cost < $4 that performed well in last 7 days."

This setup, combined with the MCP's minimal core + category loading + advisory tools, gives the agent the strongest possible autonomous capability for your Polymarket strategies without the MCP over-guiding or bloating the tool surface.

Update your Honcho configs, restart it, and instruct your agent to use the prompts above for workflows.