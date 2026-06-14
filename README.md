# Alpha-MCP-TS — DEPRECATED FOR AGENTS

**AGENTS: USE ONLY https://github.com/Ghost-Network666/Alpha-MCP-TS/blob/main/AGENTS.md**

This README.md has been removed from all agent usage, links, and "been used" paths (per request). The sole canonical file for the "never guess" contract, mandatory reads, recipes, routing, prompts, startup, and all instructions is **AGENTS.md** (the GitHub link above).

All prior references to this README (including relative "see README.md") have been excised. The project's GitHub blob URL for README.md is no longer active or referenced for agents or the MCP contract.

For human/repo overview only (non-agents): see AGENTS.md for the full authoritative content, build, usage, and rules.

(Original detailed content moved / deprecated to enforce single source of truth in AGENTS.md.)

## Step 1 — Build

```bash
pnpm install
pnpm build
```

## Step 2 — Environment variables

**Canonical credentials (multi-host auto-detection):** The MCP automatically detects the host framework and loads the correct .env with proper isolation. No manual symlinks or duplication required.

- **Hermes (profile isolation recommended):** Set `HERMES_HOME` (e.g. `~/.hermes/profiles/trader`) and place secrets in `$HERMES_HOME/.env`. When `HERMES_HOME` is set the global `~/.hermes/.env` is **not** loaded (prevents cross-profile leakage). If `HERMES_HOME` is unset but `~/.hermes` exists, the default `~/.hermes/.env` is used.
- **OpenClaw:** Secrets live in `~/.openclaw/.env` (or the path indicated by `OPENCLAW_HOME` / gateway config). Process environment injected by `openclaw.json` has highest precedence. Workspace `.env` files are ignored for provider secrets (per OpenClaw security rule).
- Direct / fallback runs still support the legacy `~/.hermes/.env` path (with a logged warning) for backward compatibility during transition.

`loadProjectEnv()` in `src/config/load-env.ts` performs the detection and logs the source (e.g. “Loaded credentials from Hermes profile ($HERMES_HOME=...)”).

- **Do not** create `Alpha-MCP-TS/.env`.
- **Do not** duplicate secrets in `mcp_servers.*.env` in Hermes `config.yaml`, Grok `config.toml` env blocks, or `--env` flags for routine use.
- Profile `.env` files under `~/.hermes/profiles/*/` must stay **empty**; gateway units use `EnvironmentFile=...`.

Put credentials in the host-appropriate location only:

```env
EOA_PRIVATE_KEY=0x...              # EOA wallet private key
DEPOSIT_WALLET_ADDRESS=0x...       # Platform deposit/proxy wallet address
POLYMARKET_ENV=mainnet             # mainnet or amoy
RELAYER_API_KEY=...                # Preferred for gasless (or use BUILDER_* instead)
RELAYER_API_KEY_ADDRESS=0x...
```

When you run the server directly (`node dist/mcp.js`), it loads `~/.hermes/.env` automatically — no project-local `.env` required.

### Agent hosts (Grok Build, Hermes, OpenClaw, etc.)

Register the MCP with **command + args only**; credentials come from `~/.hermes/.env`:

```yaml
mcp_servers:
  polymarket:
    command: node
    args: ["/path/to/Alpha-MCP-TS/dist/mcp.js"]
    enabled: true
```

This MCP maps aliases internally: `EOA_PRIVATE_KEY` → `PRIVATE_KEY`, `DEPOSIT_WALLET_ADDRESS` → `WALLET_ADDRESS`.

Auth note: API keys must be derived from the EOA private key. Every order payload must have maker = signer = deposit wallet, ownerAddress = EOA.

## Hermes Installation (Recommended)

**Important for Agents & Safety**: This MCP is deliberately lightweight (tiny default core + categories/prompts for the full surface). Hermes allows you to register it with a safe default subset of tools so agents are not overwhelmed and sensitive actions are not exposed by default.

**Hermes is the brain. Heartbeat is the core.** Hermes owns primary strategy, its native heartbeat.md / OpenClaw CLOB session liveness enforcement, the loop, and control. The MCP is the integration surface (send_heartbeat hook for host heartbeat.md compliance + route_agent_intent / run_agent_cycle with lockedStrategyKey as heartbeat-callable complete intent routing planners + supporting strategy bag for composite per-market:volume rules + signals with host externalSignals). The host drives calls from its heartbeat/resource events so the MCP remains active and the consuming agent never has to guess.

**SDK source of truth (consult first, do not guess):** https://github.com/Polymarket/ts-sdk/blob/main/README.md (linked first in the `mcp_llms_full_guide` prompt + `polymarket://mcp/llms.txt`; MCP provides no tools or resources that serve full .MD content). Confirm routed tools against `sdkAlignment.mcpToSdk` from `route_agent_intent` before `place_*`.

**Agent startup (every host heartbeat-driven session):**
1. On Hermes heartbeat/resource tick: `send_heartbeat` first (per host heartbeat.md contract) then `route_agent_intent({ intent: "session_startup", heartbeat: true })` — runs `get_agent_recipes` + `get_strategies(locked?)` (consult `prompts/get mcp_llms_full_guide` which starts with the canonical SDK README URL + MCP mappings)
2. `route_agent_intent({ intent: "rewards_farm"|"weather_alpha"|..., lockedStrategyKey, heartbeat: true })` — execute every returned step in order (plans carry the lock + explicit next native calls)
3. Prompts: `agent_routing`, `never_guess_contract`, `mcp_tool_structure_and_categories`, `mcp_llms_full_guide` (SDK URL first)

See `AGENTS.md` and `docs/HERMES_AGENT_BOOTSTRAP.md` (paste into `~/.hermes/AGENTS.md` / `SOUL.md`). Prefer `discover_topic({ topic })` over bare category filters. `load_agent_profile` when the route plan says so, then re-call `tools/list`. Rules for the locked composite live in the strategy bag (`get_strategies` / `update_strategy`); Hermes owns the primary brain and evolves them on its heartbeat ticks.

### Recommended Registration (with safe defaults)

**What the MCP actually expects from an agent at install/registration time (these are now enforced as required or defaulted when the MCP runs):**

- `EOA_PRIVATE_KEY` (or `PRIVATE_KEY`) — required (your EOA private key)
- `DEPOSIT_WALLET_ADDRESS` (or `WALLET_ADDRESS`) — required (your deposit/proxy wallet address; this MCP is public — no defaults or hardcoded values are provided or allowed)
- `BUILDER_API_KEY` + `BUILDER_SECRET` + `BUILDER_PASSPHRASE` — one valid auth strategy (direct builder HMAC)
- `RELAYER_API_KEY` + `RELAYER_API_KEY_ADDRESS` — the other valid auth strategy (gasless on verified accounts)

You must supply **at least one** of the two strategies (both are supported and create separate clients). Relayer is preferred when available for gasless trading.

Ensure wallet keys and relayer/builder auth are in `~/.hermes/.env`, then register **without** `--env` flags:

```bash
hermes mcp add polymarket \
  --command node \
  --args "/absolute/path/to/AlphaMCP-TS/dist/mcp.js" \
  --tools-include "get_agent_recipes,discover_topic,fetch_market,get_strategies,list_positions,get_balance_allowance"
```

Hermes `--tools-include` is optional: the MCP exposes **tier-1** (core daily + `route_agent_intent`). Omit the flag to use that default. For full flows, let the agent call `route_agent_intent` (it includes `load_agent_profile` when needed) then re-call `tools/list`.

After registration:

```bash
hermes mcp test polymarket
```

Verify health after add:

```bash
hermes mcp test polymarket
```

(`polymarket` = the server name you chose in `hermes mcp add`.)

Then in any Hermes session:

```bash
/reload-mcp
```

It is strongly recommended to start a **fresh session** after first setup.

### Later Adjustment

You (or an advanced agent) can change the enabled tools at any time with:

```bash
hermes mcp configure polymarket
```

This opens an interactive checklist.

### Credential Handling (Critical)

- **Never** commit `EOA_PRIVATE_KEY`, `DEPOSIT_WALLET_ADDRESS`, or other secrets anywhere.
- All credentials live in **`~/.hermes/.env` only** — edit that file when keys change; then `npm run build` and `/reload-mcp` (or restart the gateway).
- **Do not** put secrets in `mcp_servers.polymarket.env` or `Alpha-MCP-TS/.env`.
- When an agent updates this repo, it must **not** re-run `hermes mcp add` with new `--env` flags — that duplicates or overwrites the canonical source.

### Authentication Strategies (Relayer vs Builder)

The SDK only allows **one** `apiKey` strategy per `SecureClient` instance. This MCP therefore supports both strategies as **separate clients**:

- **Relayer** (`RELAYER_API_KEY` + `RELAYER_API_KEY_ADDRESS`): Recommended for gasless trading on verified accounts. The Relayer is typically linked to a Builder for attribution/rewards.
- **Builder** (`BUILDER_API_KEY` + `BUILDER_SECRET` + `BUILDER_PASSPHRASE`): Direct HMAC builder authentication (no gasless).

You must provide **at least one** complete set. Both can be supplied at the same time — `getSecureClient()` will prefer Relayer (gasless) when available, while `getRelayerClient()` and `getBuilderClient()` give you explicit access.

**Public repo note:** This is a public project. Always use your own keys in production. The examples below use placeholders for user-provided setups. For the project's own recommended Relayer setup (which "works" for gasless with builder attribution), see the specific example.

**Recommended config example** (secrets in `~/.hermes/.env`, not here):

```yaml
mcp_servers:
  polymarket:
    command: node
    args: ["/path/to/Alpha-MCP-TS/dist/mcp.js"]
    enabled: true
```

**Relayer setup (gasless):** put `EOA_PRIVATE_KEY`, `DEPOSIT_WALLET_ADDRESS`, `RELAYER_API_KEY`, and `RELAYER_API_KEY_ADDRESS` in `~/.hermes/.env`. Hermes `config.yaml` stays command/args only (same YAML as above).

The old hard requirement for only Builder keys in MCP mode has been removed. Either strategy (or both) now works.

### Updating the MCP (Safe Flow for Agents)

This is the correct and safe way for agents to keep the MCP updated:

1. Pull latest code and rebuild (credentials are never touched):
   ```bash
   cd /absolute/path/to/Alpha-MCP-TS
   git pull
   pnpm install && pnpm build     # or: npm install && npm run build
   ```

2. In your Hermes session:
   ```bash
   /reload-mcp
   ```

3. (Recommended) Start a fresh session.

**Registration is one-time only.** After the initial `hermes mcp add`, you should only ever pull the repo + rebuild + `/reload-mcp`. Never re-run the add command on updates.

(No helper scripts are included or referenced — all updates are manual git pull + rebuild to keep the tree free of testing/integration files.)

**Note**: Requires Node.js ≥ 22.

## MCP health check (doctor)

Run after every `npm run build` and before trading sessions.

| Host | Command |
|------|---------|
| **Repo (any host)** | `npm run doctor` |
| **In MCP session** | `tools/call mcp_doctor` |
| **Grok Build** | `grok mcp doctor alphamcp` |
| **Hermes** | `hermes mcp test <server_name>` (name from `~/.hermes/config.yaml`, e.g. `polymarket`) |
| **OpenClaw** | `openclaw mcp doctor <server_name> --probe` |

Expect: handshake OK, tier-1 tool count ~30, `routingAlwaysOn: true`, `gammaTagCount: 100`.

## Grok Build

Project config: `.grok/config.toml` (copy and fix the `cd` path to your clone).

```bash
npm run build
npm run doctor
grok mcp doctor alphamcp
```

Start a **new Grok Build session** after every rebuild so the host reloads `dist/mcp.js`.

User-level config can mirror the same server in `~/.grok/config.toml`. WSL users may need `bash -lc` and an explicit `node` path (see your local `.grok/config.toml`).

**Agent contract:** Built-in routing on every native tool. Consult `prompts/get mcp_llms_full_guide` (canonical SDK README URL first at https://github.com/Polymarket/ts-sdk/blob/main/README.md + mappings) → explicit trade numbers on `place_*` (never intent).

## OpenClaw

Add the server with explicit environment variables in `~/.openclaw/openclaw.json` (or your OpenClaw config). The MCP will automatically detect the OpenClaw context (via `OPENCLAW_HOME`, `OPENCLAW_GATEWAY`, or presence of `~/.openclaw`) and load `~/.openclaw/.env` (process `env` block from the json has highest precedence). You can still supply wallet + keys directly in the json `env` if preferred.

```json
{
  "mcp": {
    "servers": {
      "polymarket": {
        "command": "node",
        "args": ["/absolute/path/to/AlphaMCP-TS/dist/mcp.js"],
        "env": {
          "EOA_PRIVATE_KEY": "0xYOUR_EOA_PRIVATE_KEY",
          "DEPOSIT_WALLET_ADDRESS": "0xYOUR_DEPOSIT_WALLET_ADDRESS",
          "POLYMARKET_ENV": "mainnet"
        }
      }
    }
  }
}
```

Restart the OpenClaw gateway after changes.

```bash
openclaw mcp doctor polymarket --probe
```

Use the server name from `mcp.servers` in `~/.openclaw/openclaw.json`. Agents: routing is always on — follow `routing.nextTools` on every tool response. The same binary works under Hermes (set `HERMES_HOME` for profile isolation) without any changes.

## Other stdio hosts

Any host that supports stdio MCP can use `node /path/to/dist/mcp.js`. Credentials are loaded automatically from the host’s preferred layout (Hermes profile via `HERMES_HOME`, OpenClaw via `~/.openclaw/.env` or gateway config, or legacy `~/.hermes/.env` with warning). Do not rely on a project-local `.env` or duplicate secrets in host `env:` blocks.

## After Code Changes (Important)

Every time you edit the TypeScript source (including fixes for stability, new tools, etc.) you **must** rebuild before agents see the change:

```bash
npm run build
# or: pnpm build
```

Then reload/restart the MCP in your agent host.

**Recent stability improvement**: The server now avoids writing any logs to stdout when launched as an MCP server (critical for Hermes, OpenClaw, and other stdio hosts). Make sure you are on a build that includes this fix.

## Formatted Responses (Important for Agents)

Every tool returns a **clean, ready-to-display card**. The agent should treat the tool output as final content and print it directly.

Key formatting rules applied to all responses:
- Prices near 0–1 are shown as both decimal and percentage: `$0.7234 (72.34%)`
- Larger prices shown as `$1.2345`
- Unix timestamps converted to `29 May 2026 14:32 UTC`
- Wallet addresses truncated: `0xE467…33f`
- Order/trade status always includes emoji:
  - `✅ FILLED`
  - `⏳ OPEN — not filled yet`
  - `⏳ PENDING — awaiting matching`
  - `❌ UNFILLED — no match found`
  - `🚫 CANCELLED`
  - `🔄 PARTIALLY FILLED`
- Every successful on-chain action (split/merge/redeem/approvals) includes a real `Confirm` link: `https://polygonscan.com/tx/0x...`
- Empty arrays become the string `"None"`
- Null/undefined fields are omitted

### Example Responses

**fetch_market** (now includes token IDs so agents can immediately use trading tools)
```json
{
  "Question": "Will Trump win the 2028 presidential election?",
  "Slug": "will-trump-win-2028",
  "Yes Price": "$0.6200 (62.00%)",
  "No Price": "$0.3800 (38.00%)",
  "Yes Token Id": "0x1234...abcd",
  "No Token Id": "0x5678...ef01",
  "Token Ids": ["0x1234...abcd", "0x5678...ef01"],
  "Volume": "12345678.0000",
  "Status": "OPEN",
  "End Date": "7 Nov 2028 00:00 UTC"
}
```

**place_limit_order** (or place_market_order)
```json
{
  "Status": "⏳ OPEN — not filled yet",
  "Order Id": "0xabc123...",
  "Side": "BUY",
  "Price": "$0.52",
  "Size": "10",
  "Filled": "0 / 10",
  "Confirm": "Not yet settled on-chain"
}
```

**split_position** (or any CTF action)
```json
{
  "Status": "✅ CONFIRMED",
  "Transaction Hash": "0x1234…abcd",
  "Confirm": "https://polygonscan.com/tx/0x1234..."
}
```

This design means agents can render tool results immediately without extra parsing or formatting logic.

## Live Resources & Subscriptions ("subscribe" — the final piece)

WebSocket subscriptions were **deliberately not exposed as tools**. Real-time data belongs in the MCP **Resources** system (the protocol-native way for servers to push updates).

### What you get
- `resources/list` + `resources/templates/list` — discover all live feeds
- `resources/read` — always returns the same beautiful pre-formatted cards as tools
- `resources/subscribe` / `resources/unsubscribe` — agent asks for push notifications
- Server automatically bridges the production-grade `ReconnectingSubscription` (with exponential backoff) to `notifications/resources/updated`

When a subscribed resource changes (new book tick, your order filled, etc.), the server emits a notification. The agent then calls `resources/read` again for the fresh formatted snapshot.

### Primary Live Resources

| URI Template                            | Live?     | Description                              | Requires Auth |
|-----------------------------------------|-----------|------------------------------------------|---------------|
| `polymarket://market/{tokenId}/book`    | Yes (WS)  | Real-time order book (bids/asks)         | No            |
| `polymarket://market/{tokenId}`         | Partial   | Market snapshot + price context          | No            |
| `polymarket://user/orders`              | Yes (WS)  | Your open orders + fills/cancels         | Yes           |
| `polymarket://user/positions`           | On change | Current positions                        | Yes           |
| `polymarket://user/portfolio`           | On change | Total portfolio value                    | Yes           |
| `polymarket://user/activity`            | On change | Recent account activity                  | Yes           |
| `polymarket://markets`                  | Snapshot  | First page only (not full catalog)       | No            |

### Example agent flow (pseudo)
```
1. resources/templates/list
2. resources/subscribe { uri: "polymarket://market/0x123.../book" }
3. (later) notification/resources/updated for that URI
4. resources/read { uri: "polymarket://market/0x123.../book" } → beautiful formatted book card
5. resources/unsubscribe when done
```

User-channel resources (`polymarket://user/*`) automatically start the authenticated user WebSocket feed. Market book resources start lightweight per-token market feeds. Everything reuses the same battle-tested reconnecting logic that powers the internal market maker strategy.

This is the correct, future-proof "subscribe" implementation.

## Tool surface (agents)

| Layer | How to see it | Count |
|-------|----------------|-------|
| Tier-1 (default `tools/list`) | Connect — no extra calls | Core daily drivers + **`route_agent_intent`** |
| Full surface | `route_agent_intent` (may call `load_agent_profile`) or categories | **110** tools (live after full profile load; treat `tools/list` as truth) |

**Tier-1 includes:** `route_agent_intent`, `get_agent_recipes`, `discover_topic`, `search_tools`, `load_agent_profile`, strategy store, `fetch_market`, `list_active_maker_reward_markets`, `get_farmability`, `get_order_book`, `get_spread`, `place_limit_order`, `place_optimized_reward_order`, trading/account meta tools, `get_uk_weather_forecast`.

**Routing:** `route_agent_intent({ intent })` returns ordered `steps[]` + `sdkAlignment` (MCP↔SDK README URL). Intent does **not** place orders — explicit `price`/`size`/`side` required.

**SDK README:** https://github.com/Polymarket/ts-sdk/blob/main/README.md (consult first via `prompts/get mcp_llms_full_guide`; MCP does not serve full .MD via tools/resources).

**Discovery:** `discover_topic({ topic })` — not `polymarket://markets` as a catalog.

**Shapes:** `get_agent_recipes` (`intentRouting` registry). No `run_autonomous_trading_cycle` — use `route_agent_intent` + strategy store loop.

All tools return pre-formatted cards (never raw SDK data). Secure tools need `EOA_PRIVATE_KEY` and `DEPOSIT_WALLET_ADDRESS` from the host.
