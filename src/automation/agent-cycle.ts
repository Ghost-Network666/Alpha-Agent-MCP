/**
 * Deterministic agent cycle planner — NO LLM, NO blocking loop in MCP.
 * Delegates to intent routing; host LLM executes returned steps.
 */

import {
  buildIntentRoute,
  intentFromCycleGoal,
  type AgentIntent,
} from '../mcp/intent-routing.js';

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
  intent: AgentIntent;
  phase: string;
  steps: CycleStep[];
  agentDirective: string;
  nextTools: string[];
  resources: string[];
  prompts: string[];
  profile?: string;
  tradingRule: string;
  note: string;
  lockedStrategyKey?: string;
  priceMovementCondition?: string;
  researchSource?: string;
};

export function buildAgentCyclePlan(params: {
  goal: CycleGoal;
  strategies?: Record<string, unknown>;
  maxMinCostUsd?: number;
  topic?: string;
  lockedStrategyKey?: string;
  heartbeat?: boolean; // For native automation: when true or lockedStrategyKey, include send_heartbeat step in the complete plan for host-driven heartbeat loops
}): AgentCyclePlan {
  const intent = intentFromCycleGoal(params.goal);
  const route = buildIntentRoute({
    intent,
    goal: params.goal,
    topic: params.topic,
    maxMinCostUsd: params.maxMinCostUsd,
    strategies: params.strategies,
    lockedStrategyKey: params.lockedStrategyKey,
    heartbeat: params.heartbeat ?? !!params.lockedStrategyKey,
  });

  return {
    success: route.success,
    goal: params.goal,
    intent: route.intent,
    phase: route.phase,
    steps: route.steps,
    agentDirective: route.agentDirective,
    nextTools: route.nextTools,
    resources: route.resources,
    prompts: route.prompts,
    profile: route.profile,
    tradingRule: route.tradingRule,
    note: `${route.note} Prefer route_agent_intent({ intent }) when the goal is not a legacy "goal" enum. For native automation on heartbeat, pass lockedStrategyKey — the plan will include send_heartbeat as first step for the host to call on heartbeat/resource events.`,
    lockedStrategyKey: route.lockedStrategyKey,
    priceMovementCondition: route.priceMovementCondition,
    researchSource: route.researchSource,
  };
}