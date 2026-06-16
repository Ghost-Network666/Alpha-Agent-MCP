/**
 * Basic internal health for npm run doctor (pure SDK proxy mode).
 * No reliance on removed meta tools (mcp_doctor as tool, strategy store tools, intelligence custom, etc).
 * Reports only handshake, stdio, basic registration count.
 */

import { GAMMA_TAG_BY_SLUG } from '../data/gamma-tag-registry.js';

export type McpDoctorReport = {
  ok: boolean;
  server: string;
  protocolVersion: string;
  handshake: 'ok' | 'failed';
  toolsListed: number;
  gammaTagCount: number;
  checks: Array<{ name: string; ok: boolean; detail: string }>;
  hostDoctorCommands: {
    grok: string;
    hermes: string;
    openclaw: string;
  };
  agentDirective: string;
};

export function buildMcpDoctorReport(
  store: Map<string, unknown>,
  opts: { toolsListed: number; handshakeOk: boolean }
): McpDoctorReport {
  const checks: McpDoctorReport['checks'] = [];

  checks.push({
    name: 'handshake',
    ok: opts.handshakeOk,
    detail: opts.handshakeOk ? 'initialize OK' : 'initialize failed — rebuild and restart host',
  });
  checks.push({
    name: 'stdio_listening',
    ok: true,
    detail: 'MCP stdio active (pure 1:1 SDK wrappers)',
  });
  checks.push({
    name: 'tools_registered',
    ok: opts.toolsListed > 0,
    detail: `tools/list reports ${opts.toolsListed} pure SDK tools (no meta)`,
  });
  checks.push({
    name: 'gamma_tags',
    ok: Object.keys(GAMMA_TAG_BY_SLUG).length >= 40,
    detail: `${Object.keys(GAMMA_TAG_BY_SLUG).length} static tag slugs`,
  });

  const ok = checks.every((c) => c.ok);
  return {
    ok,
    server: 'alphamcp / clob-mcp (pure SDK)',
    protocolVersion: '2024-11-05',
    handshake: opts.handshakeOk ? 'ok' : 'failed',
    toolsListed: opts.toolsListed,
    gammaTagCount: Object.keys(GAMMA_TAG_BY_SLUG).length,
    checks,
    hostDoctorCommands: {
      grok: 'grok mcp doctor alphamcp',
      hermes: 'hermes mcp test <server_name>   # e.g. polymarket — live handshake + tool list',
      openclaw: 'openclaw mcp doctor <server_name> --probe',
    },
    // v2Alignment removed (basic doctor)
    // intelligenceRole removed (basic doctor for pure SDK)ls via heartbeat. Tools like generate_alpha_report, rank_market_opportunities, and compute_market_signals remain native. Their job is to produce research-backed signals (not decisions). These signals are fed into the strategy store (supporting data layer) so Hermes can use them when executing the locked per-market/per-volume strategy. The Intelligence layer must never execute trades directly — only provide data. MCP does not host models or a model under MCP (per host direct use by Hermes/OpenClaw).\n\nUnlike common categories of current prediction market intelligence systems, on-chain analytics platforms, and autonomous trading agents (Simple alpha reports / ranking engines; Bayesian signal blending; Basic regime detection; External data scraping + LLM summarization), the MCP deliberately provides only deterministic SDK + host-externalSignals-fused signals and simple ranking/health/competition/farmability cards. Lightweight helpers such as computeBayesianPosterior (for contradiction detection in the signals card only) are present; these are not hosted models or blending engines. Any complex modeling, regime detection, or LLM summarization is performed by Hermes (the brain) or supplied upstream via externalSignals.\n\nNarrow specialized research tools (get_liquidity_health, get_competition_signal, compute_divergence, get_reward_farmability_snapshot, analyze_signal_contradiction, and granular research_* intents) exist so the host can orchestrate many narrow mandates on its heartbeat, persisting after each under the locked key. The host (not the MCP) runs the "swarm" via native tools + intent routing. See get_agent_recipes (intelligenceLayerRole + narrowResearchMandates + endToEndProductionAutonomousExample) for the full contract.\n\nTHE TOOL THAT LOCKS THE AGENT IS TOGGLEABLE (off by default, host-controlled): route_agent_intent({ intent: "enable_locked_autonomy", lockedStrategyKey: "market:volume" }) sets strategyLock:true on that composite via update_strategy. Use "disable_locked_autonomy" (or direct update_strategy) to turn it off. heartbeat_locked_autonomy plans inspect the flag after get_strategies(locked); only when true do they emit the hard "LOCKED TO this key ONLY... STAY LOCKED... narrow research sequence only for this key" directive + restriction. When false (default), the key is still excellent for targeted narrow research/signals/price-movement on the host heartbeat, but the brain retains full routing freedom. This is the explicit native surface Hermes/OpenClaw uses to arm/disarm strict per-tick pinning.',
    agentDirective: ok
      ? 'MCP healthy. Pure 1:1 Polymarket SDK only (no meta). tools/list returns complete surface. Call by exact name. See AGENTS.md.'
      : 'MCP unhealthy — npm run build + restart host.',
  };
}