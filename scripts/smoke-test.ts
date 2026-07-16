#!/usr/bin/env tsx
/**
 * End-to-end smoke test: builds nothing (assumes dist/ already built by the
 * pretest hook), spawns the actual MCP server over stdio exactly as a real
 * agent host would, performs the MCP handshake, and checks:
 *   - the server starts (builder-integrity check doesn't kill it)
 *   - tools/list returns a non-trivial, well-formed tool set
 *   - a representative read-only public tool call succeeds end-to-end
 *
 * This is the "does it actually work for a first-time clone" check —
 * no credentials required, no orders placed.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const READ_ONLY_SMOKE_TOOL = 'list_markets';

async function main() {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ['dist/mcp.js'],
    stderr: 'pipe',
  });

  const client = new Client({ name: 'smoke-test-client', version: '1.0.0' }, { capabilities: {} });

  const stderrChunks: string[] = [];
  transport.stderr?.on('data', (chunk) => stderrChunks.push(chunk.toString()));

  console.log('Connecting to MCP server over stdio (dist/mcp.js)...');
  await client.connect(transport);
  console.log('Handshake OK — server accepted the connection (builder-integrity check passed).');

  const { tools } = await client.listTools();
  if (!Array.isArray(tools) || tools.length === 0) {
    throw new Error('tools/list returned no tools.');
  }
  for (const tool of tools) {
    if (!tool.name || !tool.description || !tool.inputSchema) {
      throw new Error(`Malformed tool definition: ${JSON.stringify(tool).slice(0, 200)}`);
    }
  }
  console.log(`tools/list OK — ${tools.length} well-formed tools discovered.`);

  const hasSmokeTool = tools.some((t) => t.name === READ_ONLY_SMOKE_TOOL);
  if (!hasSmokeTool) {
    throw new Error(`Expected tool "${READ_ONLY_SMOKE_TOOL}" not found in tools/list output.`);
  }

  if (process.env.SMOKE_TEST_OFFLINE) {
    console.log('SMOKE_TEST_OFFLINE set — skipping live tool call (protocol-only check).');
    await client.close();
    console.log('\nSMOKE TEST PASSED (offline mode).');
    return;
  }

  console.log(`Calling read-only tool "${READ_ONLY_SMOKE_TOOL}" (requires network egress to Polymarket)...`);
  const result = await client.callTool({ name: READ_ONLY_SMOKE_TOOL, arguments: { pageSize: 1 } });
  const text = (result as any)?.content?.[0]?.text || '';
  if ((result as any).isError) {
    if (/fetch failed|ENOTFOUND|ETIMEDOUT|allowlist|network/i.test(text)) {
      console.log(`\nProtocol layer PASSED, but the live call could not reach Polymarket from this`);
      console.log(`environment (${text.slice(0, 200)}).`);
      console.log('Run this again from a host with real network egress to confirm end-to-end.');
      await client.close();
      console.log('\nSMOKE TEST PASSED (protocol-only — network egress unavailable here).');
      return;
    }
    throw new Error(`Tool call returned an error result: ${JSON.stringify(result).slice(0, 500)}`);
  }
  console.log(`Tool call OK — server round-tripped a real response.`);

  await client.close();
  console.log('\nSMOKE TEST PASSED.');
}

main().catch((err) => {
  console.error('\nSMOKE TEST FAILED:', (err as Error).message || err);
  process.exit(1);
});
