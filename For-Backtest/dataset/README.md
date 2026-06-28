# Polymarket Backtesting Dataset

Compact reference indexes for LLM agents. Load the smallest file that answers your question — then call MCP tools for live detail.

---

## Files

| File | What it is | Size | When to load |
|------|-----------|------|-------------|
| `market_top50.json` | Top 50 markets by volume | ~10KB | Default starting point |
| `market_index.json` | All 500 active markets | ~108KB | When top50 isn't enough |
| `market_top_liquidity.json` | Top 50 markets by liquidity | ~10KB | For maker/reward farming |
| `active_events_index.json` | 300 active event groups | ~70KB | Browse event categories |
| `closed_events_index.json` | 300 resolved events + final prices | ~129KB | Backtesting ground truth |
| `tags_index.json` | All tags (id, label, slug) | ~6KB | Resolve tag slugs for queries |

---

## Schema

**Market entry** (`market_top50.json`, `market_index.json`):
```json
{ "id":"608362", "slug":"will-openai-ipo...", "q":"Will OpenAI IPO above $300B?",
  "p":{"Yes":0.10,"No":0.90}, "vol":277483, "liq":5767, "end":"2026-06-30", "tags":["openai"] }
```

**Active event entry** (`active_events_index.json`):
```json
{ "id":"48292", "title":"OpenAI IPO", "slug":"openai-ipo", "end":"2026-12-31",
  "vol":1735978, "liq":56268, "n":4, "tags":["openai","ai"] }
```

**Closed event entry** (`closed_events_index.json`) — includes resolved market prices:
```json
{ "id":"12345", "title":"2024 US Election", "slug":"2024-us-election", "end":"2024-11-05", "vol":500000,
  "mkts":[{ "id":"111", "q":"Will Trump win?", "p":{"Yes":1.0,"No":0.0}, "vol":250000 }] }
```

**Tag entry** (`tags_index.json`):
```json
{ "id":"537", "label":"OpenAI", "slug":"openai" }
```

---

## Usage Pattern for Agents

1. **Orient** — load `market_top50.json` or `tags_index.json` (small, fast)
2. **Identify** — pick slug or tag from the index
3. **Fetch live detail** — call MCP: `fetch_market({slug})` or `discover_topic({topic})`
4. **Backtest** — use `closed_events_index.json` for resolved outcomes

Never load `market_index.json` or `closed_events_index.json` unless you need broad coverage — prefer targeted MCP tool calls instead.
