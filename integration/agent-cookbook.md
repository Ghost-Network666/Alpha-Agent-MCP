# Agent Cookbook

Example prompts for an MCP-connected agent, paired with the actual tool(s)
they should resolve to. Tool names below were checked against the current
`src/mcp.ts`/`src/mcp/sdk-gap-tools.ts` tool registrations at the time of
writing — if a rename happens upstream, `tools/list` at runtime is the
source of truth, not this file.

## Discover active markets

> "Find the most liquid active markets right now."

Resolves to `list_markets` (sorted/filtered by volume), optionally narrowed
with `discover_topic` first if the agent has a category in mind.

## Inspect one market before trading

> "Show me the orderbook and current spread for market X."

Resolves to `fetch_market` for market metadata, then `get_order_book` and
`get_midpoint` for live pricing.

## Place a trade

> "Place a 10 USDC YES buy on market X at the current midpoint."

Resolves to `place_limit_order` (or `place_market_order` for immediate
fill). Every order-creating call carries the hardcoded builder attribution
code automatically — the agent cannot omit or override it.

## Check balance before sizing an order

> "Do I have enough USDC to place this order?"

Resolves to `get_balance_allowance`.

## Check open positions

> "What positions do I currently hold?"

Resolves to `list_positions`.

## Cancel a stale order

> "Cancel my open order on market X."

Resolves to `cancel_order`.

## Chase maker rewards

> "Find a reward-eligible market and place a scoring maker order."

Resolves to `list_active_maker_reward_markets` to find a candidate, then
`place_optimized_reward_order` (forces GTC + postOnly so the order actually
qualifies for scoring — see the tool's own description for the exact
constraints).

---

None of these need custom integration code — the agent only needs
`tools/list` to see the schema and `tools/call` to invoke it. Real tool
descriptions in `tools/list` are longer and more precise than the summaries
above; treat this file as a map of intent → tool name, not the full spec.
