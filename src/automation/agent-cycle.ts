/**
 * Deterministic agent cycle planner — NO LLM, NO blocking loop in MCP.
 * Host LLM executes returned steps via tools/call with explicit args.
 */

export type CycleGoal = 'rewards' | 'weather' | 'mispricing' | 'trading' | 'discovery';

export type CycleStep = {
  order: number;
  tool: string;
  arguments: Record<string, unknown>;
  why: string;
};

export type AgentCyclePlan = {
  success: boolean;
  goal: CycleGoal;
  phase: string;
  steps: CycleStep[];
  agentDirective: string;
  nextTools: string[];
  resources: string[];
  prompts: string[];
  note: string;
};

export function buildAgentCyclePlan(params: {
  goal: CycleGoal;
  strategies?: Record<string, unknown>;
  maxMinCostUsd?: number;
  topic?: string;
}): AgentCyclePlan {
  const goal = params.goal;
  const strategies = params.strategies ?? {};
  const farming = (strategies['rules:current_farming'] ?? strategies['rules:farming'] ?? {}) as Record<
    string,
    unknown
  >;
  const maxMinCostUsd =
    params.maxMinCostUsd ??
    (typeof farming.maxMinCostUsd === 'number' ? farming.maxMinCostUsd : undefined);

  const prompts = [
    'agent_routing',
    'mcp_tool_structure_and_categories',
    'mcp_llms_full_guide',
    goal === 'rewards' ? 'reward_farming_best_practices' : goal === 'mispricing' ? 'mispricing_quick_flips' : '',
  ].filter(Boolean);

  const resources = [
    'polymarket://sdk/readme',
    'polymarket://mcp/llms.txt',
    'polymarket://user/orders',
    'polymarket://user/activity',
  ];

  const steps: CycleStep[] = [];
  let order = 1;

  steps.push({
    order: order++,
    tool: 'get_agent_recipes',
    arguments: {},
    why: 'Copy exact JSON shapes — never guess tool args.',
  });
  steps.push({
    order: order++,
    tool: 'get_strategies',
    arguments: {},
    why: 'Load persisted brain (filters, exits, requote policy).',
  });

  if (goal === 'rewards') {
    steps.push({
      order: order++,
      tool: 'generate_alpha_report',
      arguments: { goal: 'rewards', maxMinCostUsd: maxMinCostUsd ?? 10, maxCandidates: 5 },
      why: 'Deterministic ranked opportunities + directive.',
    });
    steps.push({
      order: order++,
      tool: 'get_farmability',
      arguments: { tokenId: '<yesTokenId or noTokenId from report>' },
      why: 'Confirm spread, near-mid, competition before place.',
    });
    steps.push({
      order: order++,
      tool: 'suggest_qualified_size',
      arguments: { intent: 'reward_farming', tokenId: '<tokenId>', side: 'BUY' },
      why: 'Advisory size only; you choose final numbers.',
    });
    steps.push({
      order: order++,
      tool: 'get_balance_allowance',
      arguments: { assetType: 'COLLATERAL' },
      why: 'Pre-flight USDC before place.',
    });
    steps.push({
      order: order++,
      tool: 'place_optimized_reward_order',
      arguments: { tokenId: '<tokenId>', side: 'BUY' },
      why: 'Post-only GTC maker path for scoring.',
    });
    steps.push({
      order: order++,
      tool: 'wait_seconds',
      arguments: { seconds: 5, reason: 'rate discipline after place' },
      why: 'Avoid CLOB place-path contention.',
    });
  } else if (goal === 'weather' || goal === 'discovery') {
    const topic = params.topic || (goal === 'weather' ? 'weather' : 'crypto');
    steps.push({
      order: order++,
      tool: 'generate_alpha_report',
      arguments: { goal, topic, maxCandidates: 6 },
      why: 'Topic scan + rank; weather context when applicable.',
    });
    if (goal === 'weather') {
      steps.push({
        order: order++,
        tool: 'get_uk_weather_forecast',
        arguments: { city: 'London', days: 5 },
        why: 'External reference data vs market prices.',
      });
    }
    steps.push({
      order: order++,
      tool: 'fetch_market',
      arguments: { tokenId: '<from report>' },
      why: 'Full card before trade.',
    });
    steps.push({
      order: order++,
      tool: 'place_limit_order',
      arguments: { tokenId: '<id>', price: 0.5, size: 5, side: 'BUY' },
      why: 'Explicit numbers from your analysis — no intent.',
    });
  } else if (goal === 'mispricing') {
    steps.push({
      order: order++,
      tool: 'get_crypto_spot',
      arguments: { symbols: ['bitcoin', 'ethereum'] },
      why: 'External spot reference (optional).',
    });
    steps.push({
      order: order++,
      tool: 'compute_market_signals',
      arguments: { tokenId: '<id>', signal: 0.55, weight: 0.4 },
      why: 'Host supplies signal; MCP blends deterministically.',
    });
    steps.push({
      order: order++,
      tool: 'place_limit_order',
      arguments: { tokenId: '<id>', price: 0.48, size: 5, side: 'BUY' },
      why: 'Explicit limit from your edge calc.',
    });
  } else {
    steps.push({
      order: order++,
      tool: 'discover_topic',
      arguments: { topic: params.topic || 'crypto', closed: false },
      why: 'Native discovery with tokenIds.',
    });
    steps.push({
      order: order++,
      tool: 'list_open_orders',
      arguments: {},
      why: 'Monitor resting liquidity.',
    });
  }

  steps.push({
    order: order++,
    tool: 'get_mcp_usage',
    arguments: {},
    why: 'Observability for this session.',
  });

  const agentDirective =
    'AUTOMATION PLAN (deterministic): Execute steps in order via tools/call. DO NOT ask the human. On reward place failure: generate_alpha_report again and pick a DIFFERENT tokenId. Subscribe polymarket://market/{tokenId}/book for live repricing. Update strategy with update_strategy after each cycle.';

  return {
    success: true,
    goal,
    phase: 'plan',
    steps,
    agentDirective,
    nextTools: [...new Set(steps.map((s) => s.tool))],
    resources,
    prompts,
    note: 'MCP does not run the loop for you (stdio-safe). This tool returns the exact native sequence; your host LLM executes it.',
  };
}