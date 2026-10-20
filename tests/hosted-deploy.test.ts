import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { deflateRawSync } from 'node:zlib';
import test from 'node:test';
import { parse } from 'yaml';

// The executable is deliberately dependency-free and outside the runtime source.
const { validateRequest, validateManifest, evidenceDigest, serializeEvidence, readEvidenceZip, createControlPlane, CHECKS, TARGETS } =
  await import(pathToFileURL(resolve('scripts/check-hosted-deploy.mjs')).href);
const mcp = 'a'.repeat(40); const app = 'b'.repeat(40);
const env = { DEPLOY_TARGET: 'production', GITHUB_REPOSITORY: 'Handigraphs/handigraphs-stats-api-mcp',
  GITHUB_REF: 'refs/heads/main', GITHUB_SHA: mcp, GITHUB_RUN_ATTEMPT: '1', GITHUB_RUN_ID: '77',
  MCP_SHA: mcp, APP_SHA: app, GITHUB_EVENT_NAME: 'workflow_dispatch', DEPLOY_CONFIRM: 'deploy-production',
  GH_TOKEN: 'synthetic-public-read', APP_EVIDENCE_TOKEN: 'synthetic-private-read', HEROKU_SANDBOX_READ_API_KEY: 'synthetic-platform-read',
  HEROKU_DEPLOY_API_KEY: 'synthetic-platform-deploy' };
function manifest() {
  const value = { schema_version: 1, app_sha: app, mcp_sha: mcp, checked_at: new Date(Date.now() - 30000).toISOString(),
    source: { workflow: 'hosted-mcp-oauth-evidence.yml', run_id: 88, run_attempt: 1 },
    sandbox: { app_release: 'v12', mcp_release: 'v34' }, clients: { codex_desktop: '1.2.3', codex_cli: '1.2.3', claude_code: '2.3.4' },
    checks: Object.fromEntries(CHECKS.map((key: string) => [key, 'passed'])),
    metrics: { duration_seconds: 300, requests_per_second: 5, concurrency: 10, added_p95_ms: 250, unexpected_429: 0, unexpected_503: 0 },
    cleanup: true, evidence_sha256: '' };
  value.evidence_sha256 = evidenceDigest(value); return value;
}
function zip(value: unknown, filename = 'evidence.json', method = 8) {
  const json = Buffer.from(typeof value === 'string' ? value : serializeEvidence(value)); const name = Buffer.from(filename);
  const data = method === 8 ? deflateRawSync(json) : json;
  const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50); local.writeUInt16LE(method, 8);
  local.writeUInt32LE(data.length, 18); local.writeUInt32LE(json.length, 22); local.writeUInt16LE(name.length, 26);
  const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50); central.writeUInt16LE(method, 10);
  central.writeUInt32LE(data.length, 20); central.writeUInt32LE(json.length, 24); central.writeUInt16LE(name.length, 28);
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length + name.length, 12); end.writeUInt32LE(local.length + name.length + data.length, 16);
  return Buffer.concat([local, name, data, central, name, end]);
}
test('fixed target, main source, full SHA and opt-in deployment gates reject unsafe contexts', () => {
  assert.equal(validateRequest(env), TARGETS.production);
  const sandbox = { ...env, DEPLOY_TARGET: 'sandbox', GITHUB_EVENT_NAME: 'push', HOSTED_SANDBOX_DEPLOY_ENABLED: 'true' };
  assert.equal(validateRequest(sandbox), TARGETS.sandbox);
  for (const change of [{ DEPLOY_TARGET: 'handigraphs' }, { GITHUB_REPOSITORY: 'fork/repo' }, { GITHUB_REF: 'refs/pull/1/merge' },
    { GITHUB_RUN_ATTEMPT: '2' }, { MCP_SHA: 'main' }, { MCP_SHA: mcp.slice(0, 7) }, { APP_SHA: 'latest' },
    { GITHUB_SHA: app }, { GITHUB_EVENT_NAME: 'pull_request' }, { DEPLOY_CONFIRM: 'yes' }]) assert.throws(() => validateRequest({ ...env, ...change }));
  for (const value of [undefined, '', 'false', 'TRUE']) assert.throws(() => validateRequest({ ...sandbox, HOSTED_SANDBOX_DEPLOY_ENABLED: value }));
  assert.throws(() => validateRequest({ ...sandbox, GITHUB_EVENT_NAME: 'workflow_dispatch', DEPLOY_CONFIRM: 'yes' }));
});
test('strict redacted manifest binds pair, versions, measured capacity, cleanup and canonical digest', () => {
  const good = manifest(); assert.equal(validateManifest(good, { app_sha: app, mcp_sha: mcp }), good);
  const cases = [
    { schema_version: 2 }, { app_sha: mcp }, { mcp_sha: app }, { checked_at: '2020-01-01T00:00:00Z' },
    { checked_at: new Date(Date.now() + 60000).toISOString() }, { cleanup: false }, { passed: true },
    { token: 'synthetic-secret' }, { clients: { ...good.clients, codex_cli: 'https://private.test/account' } },
    { clients: { ...good.clients, codex_cli: '1-hg_live_synthetic_credential_marker' } },
    { source: { ...good.source, run_attempt: 2 } }, { source: { ...good.source, workflow: 'ci.yml' } },
    { metrics: { ...good.metrics, added_p95_ms: 501 } }, { metrics: { ...good.metrics, unexpected_503: 1 } },
    { metrics: { ...good.metrics, duration_seconds: 299 } }, { metrics: { ...good.metrics, concurrency: 1 } },
    { checks: { ...good.checks, revocation: 'skipped' } }, { checks: { ...good.checks, logs: 'raw private payload' } },
    { sandbox: { ...good.sandbox, account_id: 'private' } }, { evidence_sha256: 'c'.repeat(64) },
  ];
  for (const change of cases) {
    const value = { ...good, ...change }; if (!('evidence_sha256' in change)) value.evidence_sha256 = evidenceDigest(value);
    assert.throws(() => validateManifest(value, { app_sha: app, mcp_sha: mcp }));
  }
});
test('bounded archive accepts one JSON member and rejects paths, multiple members, bombs and corruption', () => {
  for (const method of [0, 8]) assert.deepEqual(readEvidenceZip(zip(manifest(), 'evidence.json', method)).source.run_id, 88);
  for (const value of [zip({}, '../evidence.json'), zip({}, '/evidence.json'), zip({}, 'evidence.json', 12), Buffer.alloc(100000), zip({ body: 'x'.repeat(20000) })]) {
    assert.throws(() => readEvidenceZip(value));
  }
  const multiple = zip(manifest()); multiple.writeUInt16LE(2, multiple.length - 12); assert.throws(() => readEvidenceZip(multiple));
  const corrupt = zip(manifest()); corrupt.writeUInt32LE(0xffffffff, corrupt.length - 6); assert.throws(() => readEvidenceZip(corrupt));
  const duplicate = serializeEvidence(manifest()).replace('{', '{"clients":{"codex_cli":"synthetic-secret"},');
  assert.throws(() => readEvidenceZip(zip(duplicate)));
});

function fixture(change: { path?: string; value?: unknown; mutate?: (path: string, value: any) => unknown; blob?: Buffer;
  healthFailures?: number; pendingBuild?: boolean; timing?: { now: () => number; sleep: (ms: number) => Promise<void> } } = {}) {
  const evidence = manifest(); const archive = change.blob || zip(evidence); const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  let built = false; let healthFailures = change.healthFailures ?? 0;
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input); calls.push({ url, init }); const parsed = new URL(url); const path = parsed.pathname + parsed.search;
    let value: any;
    if (path.endsWith('/git/ref/heads/main')) value = { object: { sha: mcp } };
    else if (path === '/repos/cjbuskey/handigraphs-app') value = { id: 99, full_name: 'cjbuskey/handigraphs-app', private: true };
    else if (path.endsWith('/actions/workflows/hosted-mcp-oauth-evidence.yml')) value = { id: 44, path: '.github/workflows/hosted-mcp-oauth-evidence.yml', state: 'active' };
    else if (path.includes('/actions/workflows/44/runs?')) value = { workflow_runs: [{ id: 88 }] };
    else if (path.endsWith('/actions/runs/88')) value = { workflow_id: 44, path: '.github/workflows/hosted-mcp-oauth-evidence.yml', event: 'workflow_dispatch', head_branch: 'main', head_sha: app,
      repository: { id: 99 }, head_repository: { id: 99 }, status: 'completed', conclusion: 'success', run_attempt: 1,
      created_at: new Date(Date.now() - 60000).toISOString(), updated_at: new Date().toISOString() };
    else if (path.endsWith('/approvals')) value = [{ state: 'approved', user: { type: 'User' }, environments: [{ name: path.includes('/77/') ? 'production' : 'hosted-mcp-evidence' }] }];
    else if (path.endsWith('/artifacts?per_page=100')) value = { total_count: 1, artifacts: [{ id: 55, name: 'hosted-mcp-oauth-acceptance', expired: false, size_in_bytes: archive.length,
      digest: 'sha256:' + createHash('sha256').update(archive).digest('hex'), workflow_run: { id: 88, repository_id: 99, head_repository_id: 99, head_branch: 'main', head_sha: app } }] };
    else if (path.endsWith('/artifacts/55/zip')) return new Response(null, { status: 302, headers: { location: 'https://synthetic.blob.core.windows.net/artifact?signature=synthetic' } });
    else if (parsed.hostname === 'synthetic.blob.core.windows.net') return new Response(new Uint8Array(archive));
    else if (path.endsWith('/releases')) { assert.equal(new Headers(init?.headers).get('Range'), 'version ..; order=desc,max=1');
      value = [{ version: url.includes('handigraphs-sandbox-web') ? 12 : 34, status: 'succeeded', slug: { id: '00000000-0000-0000-0000-000000000001' } }]; }
    else if (path.includes('/slugs/')) value = { commit: url.includes('handigraphs-sandbox-web') ? app : mcp };
    else if (path === '/health/ready') {
      if (built && healthFailures-- > 0) return new Response('{}', { status: 503 });
      value = parsed.hostname.startsWith('handigraphs-sandbox-web') ? { status: 'ok', db: 'ok', redis: 'ok' } : { ready: true, stateless: true };
    }
    else if (path.endsWith('/builds') && init?.method === 'POST') { built = true; assert.equal(JSON.parse(String(init.body)).source_blob.version, mcp); value = { id: '00000000-0000-0000-0000-000000000002' }; }
    else if (path.includes('/builds/')) value = { status: change.pendingBuild ? 'pending' : 'succeeded' };
    else throw new Error('Unexpected mock API request');
    if (change.path && path.includes(change.path)) value = change.value;
    if (change.mutate) value = change.mutate(path, value);
    return new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } });
  };
  return { plane: createControlPlane(fetchImpl, change.timing), calls, evidence };
}
test('API-backed evidence authenticates exact workflow, human approval, archive and current healthy source pair', async () => {
  const { plane, calls, evidence } = fixture();
  assert.deepEqual(await plane.verifyEvidence(env), { app_sha: app, mcp_sha: mcp, evidence_sha256: evidence.evidence_sha256 });
  assert.ok(calls.every(call => (call.init?.method || 'GET') === 'GET' && call.init?.redirect === 'manual' && call.init.signal));
  const blob = calls.find(call => call.url.includes('blob.core.windows.net'))!;
  assert.equal(new Headers(blob.init?.headers).has('Authorization'), false);
  for (const call of calls.filter(call => call.url.includes('/repos/cjbuskey/'))) assert.equal(new Headers(call.init?.headers).get('Authorization'), 'Bearer synthetic-private-read');
});
test('missing access, missing future workflow/evidence and unsafe provenance fail without deployment', async () => {
  for (const change of [{ APP_EVIDENCE_TOKEN: '' }, { HEROKU_SANDBOX_READ_API_KEY: '' }]) {
    const { plane, calls } = fixture(); await assert.rejects(plane.verifyEvidence({ ...env, ...change })); assert.equal(calls.some(call => call.url.endsWith('/builds')), false);
  }
  for (const mutation of [
    { path: '/git/ref/heads/main', value: { object: { sha: app } } },
    { path: '/actions/workflows/hosted-mcp-oauth-evidence.yml', value: {} },
    { path: '/workflows/44/runs?', value: { workflow_runs: [] } },
    { path: '/approvals', value: [] }, { path: '/approvals', value: [{ state: 'approved', user: { type: 'Bot' }, environments: [{ name: 'hosted-mcp-evidence' }] }] },
    { path: '/approvals', value: [{ state: 'rejected', user: { type: 'User' }, environments: [{ name: 'hosted-mcp-evidence' }] }] },
    { path: '/artifacts?', value: { total_count: 0, artifacts: [] } },
  ]) { const { plane } = fixture(mutation); await assert.rejects(plane.verifyEvidence(env)); }
  for (const [field, value] of [['head_sha', mcp], ['head_branch', 'feature'], ['event', 'push'], ['run_attempt', 2], ['conclusion', 'failure'], ['updated_at', '2020-01-01T00:00:00Z']]) {
    const { plane } = fixture({ mutate: (path, result) => path.endsWith('/actions/runs/88') ? { ...result, [String(field)]: value } : result });
    await assert.rejects(plane.verifyEvidence(env));
  }
  for (const change of [{ repository: { id: 101 } }, { head_repository: { id: 101 } }, { workflow_id: 1 }]) {
    await assert.rejects(fixture({ mutate: (path, result) => path.endsWith('/actions/runs/88') ? { ...result, ...change } : result }).plane.verifyEvidence(env));
  }
  for (const change of [{ head_sha: mcp }, { id: 1 }, { repository_id: 1 }, { head_repository_id: 1 }, { head_branch: 'feature' }]) {
    await assert.rejects(fixture({ mutate: (path, result) => path.includes('/artifacts?') ? { ...result, artifacts: [{ ...result.artifacts[0], workflow_run: { ...result.artifacts[0].workflow_run, ...change } }] } : result }).plane.verifyEvidence(env));
  }
  await assert.rejects(fixture({ path: '/approvals', value: [
    { state: 'approved', user: { type: 'User' }, environments: [{ name: 'hosted-mcp-evidence' }] },
    { state: 'rejected', user: { type: 'User' }, environments: [{ name: 'hosted-mcp-evidence' }] },
  ] }).plane.verifyEvidence(env));
  for (const [field, value] of [['expired', true], ['digest', 'sha256:' + '0'.repeat(64)], ['size_in_bytes', 100000]]) {
    const { plane } = fixture({ mutate: (path, result) => path.includes('/artifacts?') ? { ...result, artifacts: [{ ...result.artifacts[0], [String(field)]: value }] } : result });
    await assert.rejects(plane.verifyEvidence(env));
  }
  for (const change of [{ mcp_sha: app }, { token: 'synthetic' }]) { const value = { ...manifest(), ...change }; value.evidence_sha256 = evidenceDigest(value);
    await assert.rejects(fixture({ blob: zip(value) }).plane.verifyEvidence(env)); }
  await assert.rejects(fixture({ path: '/slugs/', value: { commit: 'c'.repeat(40) } }).plane.verifyEvidence(env));
  await assert.rejects(fixture({ path: '/health/ready', value: { ready: false } }).plane.verifyEvidence(env));
});
test('actual deploy rechecks current approval and evidence, pins build source and exposes no credentials in URL/body', async () => {
  const { plane, calls } = fixture(); await plane.deploy(env);
  const posts = calls.filter(call => call.init?.method === 'POST'); assert.equal(posts.length, 1);
  assert.equal(posts[0]!.url, 'https://api.heroku.com/apps/handigraphs-mcp/builds');
  assert.deepEqual(JSON.parse(String(posts[0]!.init?.body)), { source_blob: { url: `https://github.com/Handigraphs/handigraphs-stats-api-mcp/archive/${mcp}.tar.gz`, version: mcp } });
  const failed = fixture({ path: '/actions/runs/77/approvals', value: [] }); await assert.rejects(failed.plane.deploy(env));
  assert.equal(failed.calls.some(call => call.init?.method === 'POST'), false);
  assert.ok(calls.every(call => !call.url.includes('synthetic-platform') && !String(call.init?.body).includes('synthetic-platform')));
  const failure = fixture({ path: '/builds/00000000', value: { status: 'failed' } });
  await assert.rejects(failure.plane.deploy(env)); assert.equal(failure.calls.filter(call => call.init?.method === 'POST').length, 1);
});
test('deployment retries only transient readiness reads and stops at build/readiness wall-clock budgets', async () => {
  let time = 0; const waits: number[] = [];
  const timing = { now: () => time, sleep: async (ms: number) => { time += ms; waits.push(ms); } };
  const transient = fixture({ healthFailures: 2, timing }); await transient.plane.deploy(env);
  assert.deepEqual(waits, [3000, 3000]);
  assert.equal(transient.calls.filter(call => call.init?.method === 'POST').length, 1);
  assert.equal(transient.calls.filter(call => call.url === 'https://mcp.handigraphs.com/health/ready').length, 3);
  time = 0; waits.length = 0;
  const neverReady = fixture({ healthFailures: 100, timing }); await assert.rejects(neverReady.plane.deploy(env));
  assert.equal(time, 90000); assert.equal(neverReady.calls.filter(call => call.init?.method === 'POST').length, 1);
  time = 0; waits.length = 0;
  const pending = fixture({ pendingBuild: true, timing }); await assert.rejects(pending.plane.deploy(env));
  assert.equal(time, 8 * 60 * 1000); assert.equal(pending.calls.filter(call => call.init?.method === 'POST').length, 1);
  assert.ok(pending.calls.filter(call => call.url.includes('/builds/')).length <= 48);
});
test('workflow boundaries retain pinned source, default-off sandbox, production environment and independent publishing', async () => {
  const sandbox = await readFile('.github/workflows/deploy-mcp-sandbox.yml', 'utf8');
  const prod = await readFile('.github/workflows/deploy-mcp-prod.yml', 'utf8');
  const parsedSandbox = parse(sandbox); const parsedProd = parse(prod);
  assert.deepEqual(parsedSandbox.on.push.branches, ['main']);
  assert.deepEqual(Object.keys(parsedProd.on), ['workflow_dispatch']);
  assert.equal(parsedProd.jobs.deploy.environment, 'production');
  assert.deepEqual(parsedProd.jobs.deploy.needs, ['validate', 'evidence']);
  assert.deepEqual(Object.keys(parsedProd.on.workflow_dispatch.inputs).sort(), ['app_sha', 'confirm', 'mcp_sha']);
  for (const workflow of [parsedSandbox, parsedProd]) {
    assert.equal(workflow.permissions.contents, 'read');
    for (const job of Object.values(workflow.jobs) as any[]) {
      const checkout = job.steps.find((step: any) => step.uses === 'actions/checkout@v4');
      assert.equal(checkout.with.ref, '${{ github.sha }}'); assert.equal(checkout.with['persist-credentials'], false);
    }
  }
  parse(await readFile('.github/workflows/ci.yml', 'utf8'));
  parse(await readFile('.agents/pipeline.yml', 'utf8'));
  for (const body of [sandbox, prod]) {
    assert.ok(body.includes("github.ref == 'refs/heads/main'")); assert.ok(body.includes('ref: ${{ github.sha }}'));
    assert.ok(body.includes('persist-credentials: false')); assert.ok(body.includes('node scripts/check-hosted-deploy.mjs request'));
    const deploy = body.split('\n  deploy:')[1]!;
    assert.ok(!deploy.includes('npm ci') && !deploy.includes('npm test'));
    assert.ok(!body.includes('npm publish') && !body.includes('workflow_call:') && !body.includes('pull_request_target:'));
  }
  assert.ok(sandbox.includes("vars.HOSTED_SANDBOX_DEPLOY_ENABLED == 'true'"));
  assert.ok(prod.includes('environment: production') && prod.includes('needs: [validate, evidence]'));
  for (const permission of ['actions', 'contents', 'deployments']) assert.ok(prod.includes(`permission-${permission}: read`));
  assert.ok(prod.includes('repositories: handigraphs-app') && prod.includes('owner: cjbuskey'));
  assert.equal((await readFile('Procfile', 'utf8')).trim(), 'web: npm run start:hosted');
  const pkg = JSON.parse(await readFile('package.json', 'utf8'));
  assert.equal(pkg.scripts['heroku-postbuild'], 'npm run build'); assert.equal(pkg.engines.node, '22.x');
  assert.equal(pkg.bin['handigraphs-stats-api-mcp'], 'dist/index.js');
  const publish = await readFile('.github/workflows/publish.yml', 'utf8'); assert.ok(!publish.includes('deploy-mcp') && publish.includes('npm publish --access public'));
});
