import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../src/server.js';

const { readHostedDistribution, validateHostedDistribution, businessWorkflow } =
  await import(pathToFileURL(resolve('scripts/check-distributions.mjs')).href);

test('hosted plugin has distinct IDs, discovery-only HTTP configuration and available marketplace policy', async () => {
  const value = await readHostedDistribution();
  assert.equal(validateHostedDistribution(value), value);
  assert.notEqual(value.codexManifest.name, value.codexMarketplace.plugins[0].name);
  assert.deepEqual(Object.keys(value.codexMcp.mcpServers), ['handigraphs-stats-hosted']);
  assert.deepEqual(value.codexMarketplace.plugins[0], {
    name: 'handigraphs-stats-api', source: { source: 'local', path: './plugins/handigraphs-stats-api' },
    policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' }, category: 'Data',
  });
  assert.deepEqual(value.claudeMarketplace.plugins[0], {
    name: 'handigraphs-stats-api', source: './plugins/handigraphs-stats-api',
    description: 'Discover MLB and NHL statistics, run filters, and save bounded research through a local MCP server.',
    version: '0.3.0', author: { name: 'Handigraphs' },
  });
});

test('unsafe transport, credential, setup, identity and marketplace-policy mutations fail offline', async () => {
  const good = await readHostedDistribution();
  const mutations = [
    (v: any) => { v.codexMcp.mcpServers['handigraphs-stats-hosted'].headers = { Authorization: 'Bearer synthetic' }; },
    (v: any) => { v.claudeMcp.mcpServers['handigraphs-stats-hosted'].env = { HANDIGRAPHS_API_KEY: '${user_config.api_key}' }; },
    (v: any) => { v.codexMcp.mcpServers['handigraphs-stats-hosted'].command = 'npx'; },
    (v: any) => { v.codexMcp.mcpServers['handigraphs-stats-hosted'].url = 'http://untrusted.test/mcp'; },
    (v: any) => { v.codexMcp.mcpServers['handigraphs-stats-hosted'].url += '?credential=synthetic'; },
    (v: any) => { v.codexMcp.mcpServers['handigraphs-stats-hosted'].oauth = { clientId: 'gateway-service' }; },
    (v: any) => { v.claudeMcp.mcpServers['handigraphs-stats-hosted'].oauth = { scopes: ['admin'] }; },
    (v: any) => { delete v.claudeMcp.mcpServers['handigraphs-stats-hosted'].type; },
    (v: any) => { v.codexManifest.name = 'handigraphs-stats-api'; },
    (v: any) => { v.claudeManifest.userConfig = { api_key: { required: true } }; },
    (v: any) => { v.codexManifest.hooks = './hooks/secret-helper.json'; },
    (v: any) => { v.files.push('skills/setup-handigraphs-stats-api/SKILL.md'); },
    (v: any) => { v.codexMarketplace.plugins[1].policy.installation = 'NOT_AVAILABLE'; },
    (v: any) => { v.claudeMarketplace.plugins[1].description = 'Install our available hosted default today'; },
    (v: any) => { v.codexMarketplace.plugins[1].source.path = '../other'; },
    (v: any) => { v.skills['query-handigraphs-stats'].hosted += '\nCall configure_api_key for OAuth failures.\n'; },
    (v: any) => { v.skills['research-handigraphs-filters'].hosted = v.skills['research-handigraphs-filters'].hosted.replace('at most five', 'at most fifty'); },
  ];
  for (const mutate of mutations) { const value = structuredClone(good); mutate(value); assert.throws(() => validateHostedDistribution(value)); }
});

test('transport-specific skills preserve the exact common business workflow and safeguards', async () => {
  const { skills } = await readHostedDistribution();
  for (const skill of Object.values(skills) as any[]) {
    assert.equal(businessWorkflow(skill.hosted), businessWorkflow(skill.local));
    assert.match(skill.hosted, /browser OAuth/); assert.match(skill.hosted, /independent opt-in/);
    assert.match(skill.hosted, /Never approve broader scopes automatically/);
    assert.match(skill.hosted, /Do not fall back to an API key/);
    assert.match(skill.local, /setup-handigraphs-stats-api/);
  }
  const research = businessWorkflow(skills['research-handigraphs-filters'].hosted);
  for (const rule of [/Research alone does\s+not authorize saving/, /explicit user confirmation before replacing/,
    /at most five attempted submissions/, /not rotate keys, grants/, /operation_id/, /identical\s+request/,
    /five seconds/, /fifteen seconds/, /ten minutes/, /24-hour/, /current revision/]) assert.match(research, rule);
});

test('local secret configuration, masked setup and Desktop extension snapshots remain unchanged', async () => {
  // Canonical Git text bytes: normalize checkout CRLF only, not any content.
  const hashes: Record<string, string> = {
    'plugins/handigraphs-stats-api/.mcp.json': '7cacb694181825399b58c9a154a16b81889f393c3b987e9906a7864eb6d556c0',
    'plugins/handigraphs-stats-api/mcp.claude.json': 'd554dc2ff9922956a32fa8e053797ae77abf58ac374c2a82766ad7334750dbc4',
    'plugins/handigraphs-stats-api/.codex-plugin/plugin.json': 'edc82143a3c56c6febcb289f8ea9a2ecbb7944b0338f61db18d634eebf4eba3f',
    'plugins/handigraphs-stats-api/.claude-plugin/plugin.json': '7ed7ac7099a2ebb200d76d98b553d854fbd24258fefccc272960e8fa5d1b2d71',
    'mcpb/manifest.json': '65e9208a130d8e61daa28862d90f6cfe51861d1f4dd664784307f69320753c98',
    'plugins/handigraphs-stats-api/skills/setup-handigraphs-stats-api/SKILL.md': 'a244cb7ee29d4b6c1ecba883eb7e887c8be5dd584b6a8bd80dfa0f7af253dfa9',
    'plugins/handigraphs-stats-api/scripts/configure-macos.mjs': '29e8591b97bf346279fee0804d2f81fd72adaf97f2db14f7876eee4bf171262e',
    'plugins/handigraphs-stats-api/scripts/configure-windows.ps1': '7d0af7e5a94a76f0b5a9ec068c443f3b6556f2397e7dfb1a8ac8894ef18f9298',
    'runtime/configure-macos.mjs': '29e8591b97bf346279fee0804d2f81fd72adaf97f2db14f7876eee4bf171262e',
    'runtime/configure-windows.ps1': '7d0af7e5a94a76f0b5a9ec068c443f3b6556f2397e7dfb1a8ac8894ef18f9298',
  };
  for (const [path, expected] of Object.entries(hashes)) {
    const bytes = (await readFile(path, 'utf8')).replaceAll('\r\n', '\n');
    assert.equal(createHash('sha256').update(bytes).digest('hex'), expected, path);
  }
});

test('official SDK clients see identical nineteen business schemas/descriptions with setup only on local', async (t) => {
  async function listing(local: boolean) {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createServer({ apiKey: local ? 'synthetic-local-credential' : 'synthetic-delegated-credential',
      baseUrl: new URL('https://synthetic.example.test/api/v1'), discoveryTtlMs: 300000, timeoutMs: 1000, maxResponseBytes: 1024 },
    { enableLocalSetup: local, fetchImpl: async () => { throw new Error('Tool listing must not query a protected API'); } });
    const client = new Client({ name: local ? 'local-distribution-fixture' : 'hosted-distribution-fixture', version: '1.0.0' });
    t.after(async () => { await client.close(); await server.close(); });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    return (await client.listTools()).tools;
  }
  const local = await listing(true); const hosted = await listing(false);
  assert.equal(local.filter(tool => tool.name === 'configure_api_key').length, 1);
  assert.equal(hosted.length, 19); assert.equal(hosted.some(tool => tool.name === 'configure_api_key'), false);
  assert.deepEqual(hosted, local.filter(tool => tool.name !== 'configure_api_key'));
});

test('hosted docs give the released install, direct URL, cache refresh and local fallback', async () => {
  const readme = await readFile('README.md', 'utf8'); const guide = await readFile('docs/codex-setup.md', 'utf8');
  const release = await readFile('docs/releasing.md', 'utf8');
  for (const text of [readme, guide, release]) assert.match(text, /https:\/\/mcp\.handigraphs\.com\/mcp/);
  for (const text of [readme, guide]) {
    assert.match(text, /codex plugin add handigraphs-stats-api-hosted@handigraphs/);
    assert.match(text, /claude plugin install handigraphs-stats-api-hosted@handigraphs/);
  }
  assert.match(guide, /codex mcp add handigraphs-stats-hosted --url https:\/\/mcp\.handigraphs\.com\/mcp/);
  assert.match(guide, /claude mcp add --transport http handigraphs-stats-hosted https:\/\/mcp\.handigraphs\.com\/mcp/);
  assert.match(guide, /new (?:conversation|task)/i); assert.match(guide, /installed skills/i);
  assert.match(guide, /one connection at a time/i); assert.match(guide, /never automatically disable/i);
  assert.match(release, /2026-10-25/);
});
