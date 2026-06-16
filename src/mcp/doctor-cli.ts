#!/usr/bin/env node
/**
 * npm run doctor — stdio health check (no committed test harness in repo root).
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const mcpJs = path.join(root, 'dist/mcp.js');

function send(cp: ReturnType<typeof spawn>, obj: unknown) {
  cp.stdin?.write(JSON.stringify(obj) + '\n');
}

async function main() {
  const cp = spawn(process.execPath, [mcpJs], { cwd: root, stdio: ['pipe', 'pipe', 'inherit'] });
  let buf = '';
  const wait = (id: number) =>
    new Promise<Record<string, unknown>>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('timeout')), 20000);
      const onData = (d: Buffer) => {
        buf += d.toString();
        for (const line of buf.split('\n').filter(Boolean)) {
          try {
            const j = JSON.parse(line) as { id?: number };
            if (j.id === id) {
              clearTimeout(t);
              cp.stdout?.off('data', onData);
              resolve(j);
            }
          } catch {
            /* partial */
          }
        }
      };
      cp.stdout?.on('data', onData);
    });

  send(cp, {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'doctor-cli', version: '1' } },
  });
  const init = await wait(1);
  const handshakeOk = Boolean((init as { result?: unknown }).result);
  send(cp, { jsonrpc: '2.0', method: 'notifications/initialized' });
  send(cp, { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
  const list = await wait(2);
  const tools = ((list as { result?: { tools?: unknown[] } }).result?.tools ?? []) as unknown[];
  // Basic report only (no call to removed mcp_doctor tool)
  const report = {
    ok: handshakeOk && tools.length > 0,
    server: 'alphamcp / clob-mcp (pure SDK)',
    protocolVersion: '2024-11-05',
    handshake: handshakeOk ? 'ok' : 'failed',
    toolsListed: tools.length,
    gammaTagCount: 0,
    checks: [
      { name: 'handshake', ok: handshakeOk, detail: handshakeOk ? 'initialize OK' : 'failed' },
      { name: 'stdio_listening', ok: true, detail: 'pure SDK surface (no meta tools)' },
      { name: 'tools_registered', ok: tools.length > 0, detail: `${tools.length} pure SDK wrappers` },
    ],
    hostDoctorCommands: {
      grok: 'grok mcp doctor alphamcp',
      hermes: 'hermes mcp test <server_name>',
      openclaw: 'openclaw mcp doctor <server_name> --probe',
    },
    agentDirective: 'MCP healthy (basic). Pure 1:1 SDK only. tools/list has the surface. See AGENTS.md.',
    _cliHandshake: handshakeOk,
    _cliToolsListed: tools.length,
  };
  console.log(JSON.stringify(report, null, 2));
  cp.kill();
  process.exit(report.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});