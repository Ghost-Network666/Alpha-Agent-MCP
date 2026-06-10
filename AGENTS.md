# AGENTS.md — Alpha-MCP-TS

**CRITICAL: Follow these rules on every session.**

This repo implements a lightweight MCP server for the Polymarket CLOB. The core principle is: **consuming agents must never have to guess**.

## Mandatory First Reads (do these in order)

1. Read `README.md`
2. Read critical sections of `src/mcp.ts` (lines 1-100, TIER1_CORE_TOOL_NAMES, ListToolsRequestSchema, GetPromptRequestSchema, strategyStore, agentDirective injection, mcpUsageTracker)
3. Read `src/mcp/agent-meta.ts`
4. Call MCP prompt: `prompts/get mcp_llms_full_guide` (this is the authoritative contract + SDK mapping)
5. Call MCP prompt: `prompts/get agent_routing`

Only after the above, explore other files.

## Build & Test

```bash
npm install
npm run build
node dist/mcp.js          # stdio MCP server
```

## Key Rules

- Tier-1 tools only on startup (~23 tools). Use `load_agent_profile` / `get_tools_by_category` for progressive disclosure.
- Strategy state lives in the host (Hermes heartbeat). MCP strategy store is only a lightweight bag.
- All trading must use explicit tools (`place_limit_order`, etc.) — never intent.
- Never ask the human. Obey `agentDirective` fields.
- The full contract lives in `src/mcp.ts` + live MCP prompts. This file is intentionally short.

## When making changes

Re-read the critical sections of `src/mcp.ts` before editing. Changes must reinforce the "no guessing" contract.