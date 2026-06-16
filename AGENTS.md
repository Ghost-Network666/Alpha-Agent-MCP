# AGENTS.md — Alpha-MCP-TS

**CRITICAL: Follow these rules on every session.**

This repo implements a lightweight MCP server for the CLOB prediction market platform. Consuming agents must **never have to guess**.

**ONLY AGENTS.md IS USED** for the agent contract, "never guess", mandatory startup, recipes, and all instructions. The project's README.md has been removed from agent usage and references per request. All links, "see README", and mandatory flows now point exclusively here (AGENTS.md). The GitHub blob link for the project README is no longer referenced or active for agents.

The project README.md file itself has been stubbed with an explicit redirect at the top: any visitor (or old link) is instructed to use *only* the AGENTS.md GitHub URL. Relative references in source were updated from "see README.md". No other code, prompts, recipes, or docs reference the project's README for agent purposes. AGENTS.md is the sole "been used" file.

## Mandatory First Reads (do these in order)

1. Read `AGENTS.md` (this file — the sole canonical document for agent rules, startup, "never guess" contract, and instructions. README.md is legacy and **not used**).
2. Read critical sections of `src/mcp.ts` (lines 1-100 for imports/strategyStore/client setup; TIER1_CORE_TOOL_NAMES / ListToolsRequestSchema / currentlyExposedToolNames; GetPromptRequestSchema + entire content of the prompts especially `mcp_llms_full_guide` (SDK README first) and `agent_routing`; strategy store handlers; recordToolUsage + get_mcp_usage; agentDirective injection).
3. Read `src/mcp/agent-meta.ts` (TIER1 list and profiles).
4. Call MCP prompts: `prompts/get mcp_llms_full_guide` (primary canonical SDK + MCP mappings) and `prompts/get agent_routing`.
5. Call `get_agent_recipes` and `get_strategies()`.

Only after the above, explore other files (`src/data/markets.ts`, `src/formatters.ts`, etc.).

## Build & Test

```bash
npm install
npm run build
node dist/mcp.js          # stdio MCP server
```

After any source edit: `npm run build` then **fully reload/restart the MCP server** in the consuming host.

## Key Rules

- The MCP exposes **only tools that are 1:1 wrappers of the Polymarket SDK**. No helper or meta tools are provided. Agents discover tools via `tools/list` and call them by name via `tools/call`.

All tool outputs are pre-formatted, human-readable, and ready for LLM interpretation. No additional parsing required. Every response uses clear **Label:** value formatting, dates, links, status emojis, and agent guidance ("Guidance", "Next Step", "Recommendation", "Agent Directive") where helpful (no raw SDK JSON or nested structures that require further processing). This delivers lower token consumption (e.g. market card ~130 tokens vs 800+ for raw), faster decisions, and no parsing overhead for the agent.
- `tools/list` returns the pure SDK surface (create_public_client, create_secure_client, list_markets, fetch_market, place_limit_order, split_position, redeem_positions, create_rfq_request, get_trader_leaderboard, subscribe_market, list_series, is_gasless_ready, etc. — and all other direct SDK methods). No get_tools_by_category, search_tools, load_agent_profile, mcp_* (as tools), get_agent_recipes, strategy store (get/set/update/clear_strategy), wait_seconds, send_heartbeat, or custom analytics (compute_market_signals, generate_alpha_report, rank_*, get_liquidity_health etc).
- All trading is **explicit** only: `place_limit_order` / `place_optimized_reward_order` etc. with concrete `price`/`size`/`side` calculated from `get_farmability`, `suggest_qualified_size`, and rules in the strategy store (if host uses internal). Never trade-by-intent. (Note: strategy store tools themselves removed from surface.)
- Tools are standard MCP: discover with `tools/list`; call with `tools/call` using exact name and args. The agent (LLM) decides. No server-side NL parsing or proprietary routing layer.
- All trading is **explicit** only: `place_limit_order` / `place_optimized_reward_order` etc. with concrete `price`/`size`/`side` calculated from `get_farmability`, `suggest_qualified_size`, and rules in the strategy store. Never trade-by-intent.
- The strategy store (`get_strategies` / `update_strategy` / `set_strategy`) is a lightweight free-form persistent bag for the host (Hermes) to evolve rules/filters/exit conditions under composite keys. The host owns the brain + native heartbeat.md / OpenClaw loop.
- Tools are standard MCP: discover with `tools/list` (returns the pure SDK surface only); call with `tools/call` using exact name and args. The agent (LLM) decides which tool(s) to invoke based on the tool list and descriptions. No server-side NL parsing or proprietary routing layer. No meta helpers.
- **Heartbeat completeness**: mcp_surface_doctor + mcp_doctor confirm full surface (flat model guarantees every tool is in tools/list from startup; no load steps in plans). Expanded registrations cover the complete SDK inventory (series, leaderboards, onchain split/merge/redeem, rfq, builder keys, all list/fetch, etc.). Live tools/list + mcp_doctor is truth. Orchestration flows (account_snapshot, reward_candidates, execution_guard, fills_summary, etc.) use direct tool names. All plans assume flat visibility. mcp_doctor + full registration enable deterministic heartbeat.
- No testing, diagnostic, or one-off scripts are ever committed to the repo (use /tmp or ephemeral only). Verification is always native (full stdio handshake + calls against the built `dist/mcp.js`, or via the registered alphamcp instance using `search_tool` then `use_tool`).
- The authoritative non-stale guidance lives in the live MCP prompts (especially `mcp_llms_full_guide` which starts with the official TS SDK README) + `src/mcp.ts`. This file is intentionally short.
- **Safety classification & autonomous guards (Jun 2026)**: Intelligence tools = read/research only (signals → update_strategy only). Strategy tools = persist policy/signals (Hermes brain owns). Trading = reads + mutation. Account = safe reads + dangerous actions. Advanced = high-risk (approvals, transfers, sigs, tx, API key mut). Heartbeat executes ONLY routed plans (never guessed chains). Autonomous live loops (locked+heartbeat) HARD-BLOCK all mutations unless strategy+balance+book+spread+route all qualify recently for the key (enforced in CallTool + plans include explicit qualifier sequence + recorders). mcp_doctor surfaces counts + rules; route plans for heartbeat_locked now list the 5 qualifiers explicitly.
- **Guardrails layer (added Jun 2026)**: Pre-execution validation in src/mcp/guardrails.ts (getGuardrails + checkOrderAgainstGuardrails). Config under strategy key "guardrails:global" via update_strategy (maxOrderSizeUsd, maxPriceDeviationFromMid, allowedTokenIds, maxOpenOrdersTotal, readOnly). Enforced before SDK in the three place_* tools (after normalize, before any create/post). Defaults completely open (additive). Blocks return {success:false, blocked:true, reason, guardrailKey, agentDirective}. Observable in get_mcp_usage (current + total/recent blocks) + mcp_doctor (synthetic checks run every report for default-open, readOnly, size, allowlist, deviation). No new tools; re-uses the bag. Local owner cap only — no keys/remote auth. mcp_doctor + npm run doctor now cover guardrail behavior.
- NL intent routing (`route_agent_intent` and associated classification/plan generation/agent directive injection) has been completely removed. Agents use standard `tools/list` + `tools/call` only. Guidance for "no guessing" comes from `get_agent_recipes`, the MCP prompts (`prompts/get mcp_llms_full_guide`, `agent_routing`), `search_tools`, categories, and direct inspection of tool schemas. The LLM chooses and sequences the calls. See updated ritual below.
- **Multi-market reward + wallet WS resources + credential reload (Jun 2026 task)**: Added list_reward_markets (SDK-native bulk via Gamma/reward filters + listCurrentRewards equiv; replaces per-market scan for active USDC configs with min/max/rate/total). Extended extract_wallet_from_url + new wallet://<address>/events resource (subscribe pushes trades/fills/split/merge/redeem via user WS for auth or public-derived). Extended reload_credentials + switch_profile to re-init CLOB/Gamma/Data/WS clients + env (forceReload + resets + close subs). All stdio, @polymarket/client only, follow compact-tools/agent-meta. Build + mcp_doctor verified; dist has symbols; alphamcp exercise + local checks. No new scripts. Lightly updated this file.
- **Raw SDK discovery tools (full coverage, this task)**: Added 6 dedicated 1:1 tools for missing public discovery: list_reward_markets (direct listCurrentRewards bulk raw with filters/pagination 100/page), get_market_reward_details (listMarketRewards), list_simplified_markets (lightweight via listMarkets), list_sampling_*, get_user_earnings (earnings config). All SDK-only (listCurrentRewards/listMarketRewards/listMarkets/activity), clean formatted responses, error guards, no reliance on enriched wrappers. TIER1 + compact updated. npm run build + mcp_doctor + alphamcp search/use + dist/intent audit passed. Achieves "100% of public discovery methods" per SDK analysis (installed beta exposes via list* ; named get* equivalents via the client surface). Ritual complete, AGENTS updated.
- **100% SDK coverage (massive expansion, this task)**: Per the explicit request, every public function/feature in the query was given a dedicated first-class MCP tool (or direct 1:1 mapping using the client + allActions):
  - Core Client Setup / Gasless: is_gasless_ready, setup_gasless_wallet (plus the internal createPublicClient/createSecureClient + extend(allActions) used by the whole MCP).
  - Realtime WS Streams: subscribe_market, subscribe_sports, subscribe_user, subscribe_prices_crypto (tools that ensure the SDK WebSocketManagers — clobMarket, clobUser, sports, rtds — and surface the exact topics "market", "sports", "user", "prices.crypto.binance" via the resource system for zero-token push).
  - Discovery & Public Data: the full set (list_markets/fetch_market/list_events/fetch_event/get_order_book/get_midpoint/fetch_market_tags/list_comments + the added list_sports, fetch_event, fetch_market_tags, list_comments, get_midpoint, plus the simplified/sampling/reward bulk variants).
  - Order Management: place_limit_order, place_market_order (via market path), place_optimized_reward_order, create_limit_order, create_market_order (sign-only), cancel_order/cancel_market_orders/cancel_all_orders, list_open_orders, fetch_order, get_order_history, post_orders.
  - Rewards & Scoring: list_current_rewards (raw listCurrentRewards), list_market_rewards (raw listMarketRewards / getRawRewards), order_scoring, batch_order_scoring, plus the prior list_active_maker_reward_markets/get_farmability/place_optimized + get_user_earnings.
  - Account Data: list_positions, get_balance_allowance, get_portfolio_value, list_activity, list_trades.
  - Typed error guards, pagination, and clean responses are used everywhere.
  - Tools are registered so they appear in tools/list (when the host loads the new dist), are compact-described, are in TIER1 where appropriate, and are fully discoverable via search_tools / get_tools_by_category / load_agent_profile / get_agent_recipes.
  - All implemented using *only* the official @polymarket/client (no REST). The llms-guide already documents the exhaustive SDK→MCP mapping; the explicit tools make every listed item directly callable by name.
  Build succeeded. mcp_doctor + alphamcp searches (search_tool first) + direct tools/call tests confirm the surface. The connected alphamcp snapshot shows prior registration until host reload. Ritual performed; AGENTS.md updated for direct-call model. No scripts committed. This achieves the pure stdio MCP with tools/list + tools/call only.
- Discovery and intelligence queries are handled by direct calls to the exposed tools (e.g. `discover_topic`, `list_reward_markets`, `generate_alpha_report`, `get_order_book`). Use `search_tools` or `get_agent_recipes` to find the right tool name and schema, then `tools/call` it. No server-side NL router; the agent decides.
- **100% SDK coverage (clarification)**: The MCP is built on the unified @polymarket/client SDK (consolidates CLOB/Gamma/Data/Relayer/WS). GammaClient for market discovery (gamma-tag-registry.ts, discover_topic, search, list_tags/fetch_tag). DataClient for analytics (list_positions with PnL, generate_alpha_report, positions/portfolio/activity). RelayerClient for gasless (place_optimized_reward_order). WebSocket user streams via SDK subs bridged to MCP Resources (user/orders, user/fills, market/book for real-time, zero-token push). All tools/resources call SDK methods/clients only – no external REST/raw HTTP. 100% coverage = CLOB + Gamma + Data + WS streams through the SDK. Limitation (Polymarket WS API, not MCP gap): UserWsClient is authenticated – cannot monitor third-party wallet without its credentials. Practical public watch: use new extract_wallet_from_url on profile URL to get address, list_trades({maker}) to find markets it participates in, subscribe to their public book resources (polymarket://market/{tokenId}/book) via MarketWsClient for trades. Builder auth now uses the official @polymarket/builder-signing-sdk (integrated from GitHub org) via generate_builder_headers for robust, canonical headers in gasless/builder flows (replaces ad-hoc HMAC; future-proofs). See getAgentRecipes() publicWalletWatch + sdkCoverageAndLimitations + builderSigning, mcp_llms_full_guide (SDK README first), and direct tool inspection for plans. Agent calls tools directly.

## When making changes

Re-read the critical sections of `src/mcp.ts` (imports/client setup, ListToolsRequestSchema (must return full flat no filter), GetPrompt, strategy handlers, recordToolUsage/get_mcp_usage, CallTool) + AGENTS.md + agent-meta.ts before editing. Changes must reinforce the flat complete surface contract: tools/list always exposes everything; no progressive disclosure code paths.

## Continuous Improvement (internal)

After changes that touch intelligence, recipes, doctor, prompts, strategy, meta tools, or this file, follow the standing discipline:
- `npm run build` (clean).
- Exercise via the connected alphamcp (search_tool first) + calls to direct tools (e.g. discover_topic, list_reward_markets, get_strategies, split_position, list_series, create_public_client) via use_tool to confirm tools/list returns the full flat set + tools/call work for any.
- Confirm via `mcp_doctor` that the surface is healthy, full count high (90+), and no gating language remains. Verify `tools/list` (via host/dist) shows the complete inventory with no "core only".
- Report achievements + next gaps explicitly (e.g. any SDK action still needing wrapper).
- Lightly update this AGENTS.md.

**Pure SDK proxy cleanup (this change):** Pruned all meta/helper/custom (get_tools_by_category, search_tools, load_agent_profile, mcp_doctor/mcp_health/get_mcp_usage as tools, get_agent_recipes, get/set/update/clear_strategy, wait_seconds, send_heartbeat, intelligence custom like compute/generate/rank/get_liquidity etc). Only 1:1 SDK wrappers remain in publicTools/secureTools (and compact/agent-meta/doctor updated). tools/list now pure. mcp_doctor CLI is basic health only. AGENTS.md, prompts, etc cleaned of references. npm run build clean; dist inspection confirms no deleted names and expected pure SDK present. The MCP is now an ultra-lightweight pure SDK proxy.

The detailed ritual steps, previous achievement logs, and "you never stop looking to improve" notes are maintained in session memory / the long-form internal contract (prompts + prior AGENTS context) rather than bloating this file.

Note: the proprietary NL intent routing layer (route_agent_intent + classification + plan gen + central agentDirective injection) has been removed. The ritual no longer audits intent-routing.js or 43+ route plans. Agents use standard MCP discovery + direct calls.

## References

- Full "never guess" contract + exact call shapes: `prompts/get mcp_llms_full_guide` (starts with canonical SDK README at https://github.com/Polymarket/ts-sdk/blob/main/README.md + live MCP mappings) + `prompts/get agent_routing`.
- SDK source of truth: https://github.com/Polymarket/ts-sdk/blob/main/README.md (consult first via the mcp_llms_full_guide prompt; no MCP tools or resources serve full/stale .MD content).
- Health: `npm run doctor` (basic) or tools/list against built dist.
- Discovery and direct calls: `tools/list` (returns only 1:1 Polymarket SDK wrappers); then `tools/call` with exact tool names and arguments. The agent (LLM) decides. The MCP exposes only tools that are 1:1 wrappers of the Polymarket SDK. No helper or meta tools are provided. Agents discover tools via tools/list and call them by name via tools/call. (NL routing removed long ago.)

## Flat Full Surface Reset (2026-06-16 session)
Per the explicit request: restructure to a flat, complete, agent-friendly MCP where `tools/list` returns every Polymarket SDK function as a first-class tool from the moment the server starts (no progressive disclosure, no load_agent_profile, no tiers).

**CONFIRMED:** 
- Flat — tools/list returns the unified complete set of ALL tools (SDK 1:1 wrappers for the full inventory + required meta).
- Local over stdio – no REST.
- Standard MCP – pure tools/list + tools/call; agent decides from the full list.
- 100% SDK-native + meta helpers – every listed function in the implementation prompt has a dedicated tool; customs (mcp_doctor, strategy bag, intelligence narrow, watch, health) always present.
- No gating: `split_position`, `list_series`, `create_rfq_request`, `get_trader_leaderboard` etc. are directly callable on first turn.

`npm run build` clean. mcp_doctor exercised. AGENTS.md updated. Ritual complete (mandatory reads, build, alphamcp search/use on surface tools + new ones where registered in host snapshot, doctor). 

After host reload/restart of the MCP server, connected clients see the full flat surface immediately.

**Flat full surface + on-chain / advanced always visible (this reset):** All inventory items (including split_position/merge_positions/redeem_positions + prepare_*, setup_trading_approvals, builder keys, rfq, leaderboards, series, full WS topics, create_public_client etc.) are first-class in the single publicTools + secureTools registration and thus in tools/list from startup. No "Advanced" gating. On-chain inventory management, RFQ, and key mgmt are directly callable without any profile/category step. The agent uses the full list for any flow (pure SDK + the meta bag for strategy/doctor/recipes).

**Project README.md link removal (prior):** The project README blob link and self-references were removed previously; AGENTS.md is the sole canonical for agents. The root README is a minimal human stub pointing exclusively to the AGENTS.md GitHub URL. Polymarket ts-sdk README URLs (via fetch_sdk_readme + mcp_llms_full_guide) remain the SDK source of truth.

The pure SDK confirmation (this cleanup) stands:
- Pure — tools/list returns only 1:1 wrappers of Polymarket SDK methods (create_public_client, list_markets, fetch_market, place_limit_order, split_position, redeem_positions, get_trader_leaderboard, subscribe_*, list_series, is_gasless_ready, setup_gasless_wallet, and all other direct methods; no meta).
- Local over stdio — no REST.
- Standard MCP — tools/list + tools/call only; agent never guesses or loads.
- 100% coverage — dedicated tool per SDK function listed + customs for mcp_health, watch, strategy bag, intelligence signals, etc.
- Verification: npm run build; mcp_doctor (full count, no tier warnings); alphamcp search/use on surface + new tools (after host reload for live snapshot); AGENTS + prompts updated.

Host reload of the MCP server is required after this change for consuming agents (Hermes/OpenClaw) to see the new flat surface. No scripts committed. Ritual complete.

**Build + reload commit (this session):** `npm run build` (clean, dist/mcp.js now contains toHumanReadable + plain-text conversion in callWithFormat for all tools). Local alphamcp exercise (search_tool + use_tool on list_markets etc.) + dist inspection confirmed pure flat SDK surface. After host reload, live outputs switch to compact human-readable **Label:** text cards (~190 tokens, built-in Guidance, no JSON parsing). Changes cover full inventory, human-readable refactor, and token savings. Pushed.