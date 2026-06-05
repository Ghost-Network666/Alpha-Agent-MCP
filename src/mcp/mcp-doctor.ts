/**
 * MCP health check — same checks as host "doctor" CLIs (Grok/Hermes/OpenClaw).
 * Callable as tier-1 tool mcp_doctor or npm run doctor.
 */

import { TIER1_CORE_TOOL_NAMES } from './agent-meta.js';
import { INTENT_REGISTRY } from './intent-routing.js';
import { GAMMA_TAG_BY_SLUG } from '../data/gamma-tag-registry.js';
import { readRoutingConfig } from './intent-context.js';

export type McpDoctorReport = {
  ok: boolean;
  server: string;
  protocolVersion: string;
  handshake: 'ok' | 'failed';
  tier1ToolCount: number;
  tier1Tools: string[];
  routingAlwaysOn: true;
  routingConfig: ReturnType<typeof readRoutingConfig>;
  intentCount: number;
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
  const tier1 = [...TIER1_CORE_TOOL_NAMES];

  checks.push({
    name: 'handshake',
    ok: opts.handshakeOk,
    detail: opts.handshakeOk ? 'initialize OK' : 'initialize failed — rebuild and restart host',
  });
  checks.push({
    name: 'tier1_surface',
    ok: opts.toolsListed >= tier1.length - 2,
    detail: `tools/list returned ${opts.toolsListed} (expected ~${tier1.length})`,
  });
  checks.push({
    name: 'routing_always_on',
    ok: true,
    detail: 'Built-in routing envelopes on every native tool (cannot disable)',
  });
  checks.push({
    name: 'mcp_doctor_tool',
    ok: tier1.includes('mcp_doctor'),
    detail: 'mcp_doctor in tier-1 for in-session health',
  });
  checks.push({
    name: 'gamma_tags',
    ok: Object.keys(GAMMA_TAG_BY_SLUG).length >= 150,
    detail: `${Object.keys(GAMMA_TAG_BY_SLUG).length} static tag slugs → tagId`,
  });

  const ok = checks.every((c) => c.ok);
  return {
    ok,
    server: 'alphamcp / clob-mcp',
    protocolVersion: '2024-11-05',
    handshake: opts.handshakeOk ? 'ok' : 'failed',
    tier1ToolCount: opts.toolsListed,
    tier1Tools: tier1,
    routingAlwaysOn: true,
    routingConfig: readRoutingConfig(store),
    intentCount: Object.keys(INTENT_REGISTRY).length,
    gammaTagCount: Object.keys(GAMMA_TAG_BY_SLUG).length,
    checks,
    hostDoctorCommands: {
      grok: 'grok mcp doctor alphamcp',
      hermes: 'hermes mcp test <server_name>   # e.g. polymarket — live handshake + tool list',
      openclaw: 'openclaw mcp doctor <server_name> --probe',
    },
    agentDirective: ok
      ? 'MCP healthy. Use native tools; obey routing.nextTools on every response.'
      : 'MCP unhealthy — run host doctor command from hostDoctorCommands, npm run build, restart host.',
  };
}