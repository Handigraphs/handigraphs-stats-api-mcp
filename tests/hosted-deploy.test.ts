import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { deflateRawSync } from 'node:zlib';
import test from 'node:test';
import { parse } from 'yaml';

// The executable is deliberately dependency-free and outside the runtime source.
const { validateRequest, validateManifest, evidenceDigest, serializeEvidence, readEvidenceZip, createControlPlane, CHECKS, TARGETS, approvalRequest, approvalDigest, approvalIssueBody, validateIssueApproval,
  OWNER_ACCEPTANCE_FILE, validateOwnerAcceptance, parseOwnerAcceptance, validateRuntimeComparison, nonRuntimePath } =
  await import(pathToFileURL(resolve('scripts/check-hosted-deploy.mjs')).href);
const mcp = 'a'.repeat(40); const app = 'b'.repeat(40);
const env = { DEPLOY_TARGET: 'production', GITHUB_REPOSITORY: 'Handigraphs/handigraphs-stats-api-mcp',
  GITHUB_REF: 'refs/heads/main', GITHUB_SHA: mcp, GITHUB_RUN_ATTEMPT: '1', GITHUB_RUN_ID: '77',
  MCP_SHA: mcp, APP_SHA: app, GITHUB_EVENT_NAME: 'workflow_dispatch', DEPLOY_CONFIRM: 'deploy-production',
  GH_TOKEN: 'synthetic-public-read', APP_EVIDENCE_TOKEN: 'synthetic-private-read', HEROKU_SANDBOX_READ_API_KEY: 'synthetic-platform-read',
  HEROKU_DEPLOY_API_KEY: 'synthetic-platform-deploy' };
const tested = '9'.repeat(40); const accepted = 'e'.repeat(40);
function acceptance(changes: Record<string, unknown> = {}) {
  return { schema_version: 1, purpose: 'hosted-mcp-owner-acceptance', owner: 'cjbuskey', decided_on: '2026-10-24',
    tested_app_sha: 'd'.repeat(40), accepted_app_sha: app, tested_mcp_sha: tested, accepted_mcp_sha: accepted, record_sha256: 'f'.repeat(64),
    clients: { codex_desktop: '26.1016.61520', codex_cli: '0.163.0', claude_code: '2.1.283' }, summary: 'Synthetic owner acceptance.', ...changes };
}
function manifest() {
  const value = { schema_version: 2, app_sha: app, mcp_sha: mcp, checked_at: new Date(Date.now() - 30000).toISOString(),
    source: { workflow: 'hosted-mcp-oauth-evidence.yml', run_id: 88, run_attempt: 1 },
    approval: { method: 'github_issue_v1', issue_number: 501, comment_id: 502, review_sha256: 'c'.repeat(64) },
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
    { schema_version: 1 }, { app_sha: mcp }, { mcp_sha: app }, { checked_at: '2020-01-01T00:00:00Z' },
    { approval: undefined }, { approval: { ...good.approval, method: 'native_environment' } },
    { approval: { ...good.approval, issue_number: true } }, { approval: { ...good.approval, comment_id: '502' } },
    { approval: { ...good.approval, review_sha256: 'x'.repeat(64) } }, { approval: { ...good.approval, approved: true } },
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
  healthFailures?: number; pendingBuild?: boolean; commentsLink?: string; apiError?: { path: string; status: number };
  timing?: { now: () => number; sleep: (ms: number) => Promise<void> }; acceptance?: string; comparison?: unknown } = {}) {
  const evidence = manifest(); const archive = change.blob || zip(evidence); const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  const run = { workflow_id: 44, path: '.github/workflows/hosted-mcp-oauth-evidence.yml', event: 'workflow_dispatch', head_branch: 'main', head_sha: app,
    repository: { id: 99 }, head_repository: { id: 99 }, status: 'completed', conclusion: 'success', run_attempt: 1,
    created_at: new Date(Date.parse(evidence.checked_at) - 600000).toISOString(), updated_at: new Date().toISOString() };
  const request = approvalRequest(evidence, run);
  const issue = { number: 501, state: 'open', user: { id: 41898282, type: 'Bot' }, body: approvalIssueBody(request),
    created_at: new Date(Date.parse(run.created_at) + 10000).toISOString() };
  const commentTime = new Date(Date.parse(run.created_at) + 60000).toISOString();
  const comments = [{ id: 502, user: { id: 39887731, type: 'User' }, body: `APPROVE ${approvalDigest(request)}`,
    created_at: commentTime, updated_at: commentTime }];
  let built = false; let healthFailures = change.healthFailures ?? 0;
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input); calls.push({ url, init }); const parsed = new URL(url); const path = parsed.pathname + parsed.search;
    let value: any;
    if (path.endsWith('/git/ref/heads/main')) value = { object: { sha: path.includes('/repos/cjbuskey/') ? app : mcp } };
    else if (path === '/repos/cjbuskey/handigraphs-app') value = { id: 99, full_name: 'cjbuskey/handigraphs-app', private: true };
    else if (path === `/repos/Handigraphs/handigraphs-stats-api-mcp/compare/${accepted}...${mcp}`) value = change.comparison
      ?? { status: 'ahead', behind_by: 0, total_commits: 1, files: [{ filename: 'deploy/owner-acceptance.json' }, { filename: 'docs/hosted-operations.md' }] };
    else if (path.endsWith('/actions/workflows/hosted-mcp-oauth-evidence.yml')) value = { id: 44, path: '.github/workflows/hosted-mcp-oauth-evidence.yml', state: 'active' };
    else if (path.includes('/actions/workflows/44/runs?')) value = { workflow_runs: [{ id: 88 }] };
    else if (path.endsWith('/actions/runs/88')) value = run;
    else if (path.endsWith('/issues/501')) value = issue;
    else if (path.endsWith('/issues/501/comments?per_page=100')) value = comments;
    else if (path.endsWith('/issues/comments/502')) value = comments[0];
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
    return new Response(JSON.stringify(value), { status: change.apiError && path.includes(change.apiError.path) ? change.apiError.status : 200,
      headers: { 'Content-Type': 'application/json',
      ...(change.commentsLink && path.includes('/issues/501/comments?') ? { Link: change.commentsLink } : {}) } });
  };
  const readAcceptance = () => change.acceptance ?? serializeEvidence(acceptance());
  return { plane: createControlPlane(fetchImpl, change.timing, { readAcceptance }), calls, evidence, run, issue, comments };
}
test('API-backed evidence authenticates exact workflow, human approval, archive and current healthy source pair', async () => {
  const { plane, calls, evidence } = fixture();
  assert.deepEqual(await plane.verifyEvidence(env), { app_sha: app, mcp_sha: mcp, evidence_sha256: evidence.evidence_sha256 });
  assert.ok(calls.every(call => (call.init?.method || 'GET') === 'GET' && call.init?.redirect === 'manual' && call.init.signal));
  const blob = calls.find(call => call.url.includes('blob.core.windows.net'))!;
  assert.equal(new Headers(blob.init?.headers).has('Authorization'), false);
  for (const call of calls.filter(call => call.url.includes('/repos/cjbuskey/'))) assert.equal(new Headers(call.init?.headers).get('Authorization'), 'Bearer synthetic-private-read');
  assert.ok(calls.some(call => call.url.endsWith('/issues/comments/502')));
  assert.equal(calls.some(call => call.url.includes('/repos/cjbuskey/') && call.url.endsWith('/approvals')), false);
});

test('shared Python/JavaScript approval vector is exact and keeps publication timing historical', async () => {
  const vector = JSON.parse(await readFile('tests/fixtures/hosted-approval-contract.json', 'utf8'));
  const evidence = { ...manifest(), app_sha: vector.request.app_sha, mcp_sha: vector.request.mcp_sha,
    source: { workflow: vector.request.workflow, run_id: vector.request.run_id, run_attempt: 1 },
    approval: vector.proof, checked_at: vector.publication_at };
  evidence.evidence_sha256 = evidenceDigest(evidence);
  const run = { created_at: vector.request.created_at };
  assert.deepEqual(approvalRequest(evidence, run), vector.request);
  assert.equal(approvalDigest(vector.request), vector.request_sha256);
  assert.equal(approvalIssueBody(vector.request), vector.issue_body);
  assert.equal(serializeEvidence(vector.request).slice(0, -1), vector.canonical_request);
  assert.doesNotThrow(() => validateManifest(evidence, { app_sha: evidence.app_sha, mcp_sha: evidence.mcp_sha }, Date.parse(vector.consume_at)));
  assert.doesNotThrow(() => validateIssueApproval(evidence, run, vector.issue, vector.comments, vector.comments[0]));
  // A valid artifact remains usable during its seven-day lifetime; only original
  // publication, not the future production invocation, has the 30-minute TTL.
  for (const time of ['2026-10-20T12:05:59Z', '2026-10-20T12:30:01Z']) {
    assert.throws(() => validateIssueApproval({ ...evidence, checked_at: time }, run, vector.issue, vector.comments, vector.comments[0]));
  }
  assert.doesNotThrow(() => validateIssueApproval({ ...evidence, checked_at: '2026-10-20T12:30:00Z' }, run, vector.issue, vector.comments, vector.comments[0]));
});

test('private issue approval rejects forged actors, changed binding, edits, rejection and stale pointers', () => {
  const { evidence, run, issue, comments } = fixture(); const owner = comments[0]!;
  const verify = (changes: { issue?: any; comments?: any; selected?: any; evidence?: any; run?: any }) => validateIssueApproval(
    changes.evidence ?? evidence, changes.run ?? run, changes.issue ?? issue, changes.comments ?? comments, changes.selected ?? owner);
  for (const change of [
    { state: 'closed' }, { number: 500 }, { pull_request: {} }, { body: issue.body + '\n' },
    { user: { id: 1, type: 'Bot' } }, { user: { id: 41898282, type: 'User' } }, { created_at: 'invalid' },
  ]) assert.throws(() => verify({ issue: { ...issue, ...change } }));
  for (const change of [
    { body: owner.body.toLowerCase() }, { user: { id: 1, type: 'User' } },
    { user: { id: 39887731, type: 'Bot' } }, { updated_at: new Date().toISOString() }, { created_at: 'invalid' },
  ]) assert.throws(() => verify({ comments: [{ ...owner, ...change }], selected: { ...owner, ...change } }));
  const spaced = { ...owner, body: ` \n${owner.body}\n ` };
  assert.doesNotThrow(() => verify({ comments: [spaced], selected: spaced }));
  for (const body of [owner.body, 'unrelated owner comment']) {
    assert.throws(() => verify({ comments: [owner, { ...owner, id: 503, body, updated_at: new Date().toISOString() }] }));
  }
  const rejection = { ...owner, id: 503, body: owner.body.replace('APPROVE ', 'REJECT ') };
  for (const history of [[rejection, owner], [owner, rejection]]) assert.throws(() => verify({ comments: history }));
  assert.throws(() => verify({ comments: [owner, { ...rejection, body: ` \n${rejection.body}\n ` }] }));
  assert.throws(() => verify({ comments: [owner, { ...owner, id: 503 }] })); // latest exact APPROVE must be pinned
  assert.throws(() => verify({ comments: [] })); // deleted or missing approval, even if pinned GET is stale
  assert.throws(() => verify({ selected: { ...owner, body: 'edited away' } }));
  assert.throws(() => verify({ selected: { ...owner, updated_at: new Date().toISOString() } }));
  for (const proof of [{ review_sha256: 'd'.repeat(64) }, { comment_id: 503 }, { issue_number: 500 }]) {
    assert.throws(() => verify({ evidence: { ...evidence, approval: { ...evidence.approval, ...proof } } }));
  }
  assert.throws(() => verify({ evidence: { ...evidence, app_sha: mcp } }));
  assert.throws(() => verify({ evidence: { ...evidence, source: { ...evidence.source, run_id: 89 } } }));
  assert.throws(() => verify({ run: { ...run, created_at: new Date(Date.parse(run.created_at) - 1000).toISOString() } }));
  assert.throws(() => verify({ comments: Array.from({ length: 100 }, (_, index) => ({ ...owner, id: index + 1 })) }));
  assert.throws(() => verify({ comments: [owner, owner] }));
});

test('private approval API is independently read-only, bounded, unpaginated and unavailable access fails closed', async () => {
  for (const change of [
    { commentsLink: '<https://api.github.com/repos/cjbuskey/handigraphs-app/issues/501/comments?page=2>; rel="next"' },
    { path: '/issues/comments/502', value: {} }, { path: '/issues/501', value: {} },
    { path: '/issues/501/comments?', value: Array.from({ length: 100 }, (_, index) => ({ id: index + 1 })) },
    { apiError: { path: '/issues/501', status: 403 } }, { apiError: { path: '/issues/501/comments?', status: 403 } },
    { apiError: { path: '/issues/comments/502', status: 404 } },
  ]) {
    const { plane, calls } = fixture(change); await assert.rejects(plane.verifyEvidence(env));
    assert.equal(calls.some(call => call.init?.method === 'POST'), false);
  }
  let reads = 0;
  const changed = fixture({ mutate: (path, value) => path.endsWith('/issues/501') && ++reads === 2 ? { ...value, state: 'closed' } : value });
  await assert.rejects(changed.plane.verifyEvidence(env));
  assert.equal(changed.calls.filter(call => call.url.endsWith('/issues/501')).length, 2);
  assert.ok(changed.calls.some(call => call.url.endsWith('/health/ready')));
  assert.equal(changed.calls.some(call => call.init?.method === 'POST'), false);
  for (const repository of ['cjbuskey/handigraphs-app', 'Handigraphs/handigraphs-stats-api-mcp']) {
    let refs = 0;
    const advanced = fixture({ mutate: (path, value) => path === `/repos/${repository}/git/ref/heads/main` && ++refs === 2
      ? { object: { sha: 'f'.repeat(40) } } : value });
    await assert.rejects(advanced.plane.verifyEvidence(env));
    assert.ok(advanced.calls.some(call => call.url.endsWith('/health/ready')));
    assert.equal(advanced.calls.some(call => call.init?.method === 'POST'), false);
  }
});
test('missing access, missing future workflow/evidence and unsafe provenance fail without deployment', async () => {
  for (const change of [{ APP_EVIDENCE_TOKEN: '' }, { HEROKU_SANDBOX_READ_API_KEY: '' }]) {
    const { plane, calls } = fixture(); await assert.rejects(plane.verifyEvidence({ ...env, ...change })); assert.equal(calls.some(call => call.url.endsWith('/builds')), false);
  }
  for (const mutation of [
    { path: '/git/ref/heads/main', value: { object: { sha: app } } },
    { path: '/actions/workflows/hosted-mcp-oauth-evidence.yml', value: {} },
    { path: '/workflows/44/runs?', value: { workflow_runs: [] } },
    { path: '/issues/501', value: {} }, { path: '/issues/501/comments?', value: [] },
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
  for (const [field, value] of [['expired', true], ['digest', 'sha256:' + '0'.repeat(64)], ['size_in_bytes', 100000]]) {
    const { plane } = fixture({ mutate: (path, result) => path.includes('/artifacts?') ? { ...result, artifacts: [{ ...result.artifacts[0], [String(field)]: value }] } : result });
    await assert.rejects(plane.verifyEvidence(env));
  }
  for (const change of [{ mcp_sha: app }, { token: 'synthetic' }]) { const value = { ...manifest(), ...change }; value.evidence_sha256 = evidenceDigest(value);
    await assert.rejects(fixture({ blob: zip(value) }).plane.verifyEvidence(env)); }
  await assert.rejects(fixture({ path: '/slugs/', value: { commit: 'c'.repeat(40) } }).plane.verifyEvidence(env));
  await assert.rejects(fixture({ path: '/health/ready', value: { ready: false } }).plane.verifyEvidence(env));
});
test('actual deploy rechecks environment approval and owner acceptance, pins build source and exposes no credentials in URL/body', async () => {
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
  assert.deepEqual(parsedProd.jobs.deploy.needs, ['validate', 'acceptance']);
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
  assert.ok(prod.includes('environment: production') && prod.includes('needs: [validate, acceptance]'));
  // Owner decision 2026-10-24: no private evidence token, sandbox read key or artifact in production.
  assert.ok(prod.includes('node scripts/check-hosted-deploy.mjs acceptance') && !prod.includes('check-hosted-deploy.mjs evidence'));
  for (const removed of ['evidence-token', 'APP_EVIDENCE_TOKEN', 'HOSTED_EVIDENCE_APP_PRIVATE_KEY', 'HEROKU_SANDBOX_READ_API_KEY']) assert.ok(!prod.includes(removed));
  assert.deepEqual(Object.keys(parsedProd.jobs.deploy.steps.at(-1).env).sort(), ['GH_TOKEN', 'HEROKU_DEPLOY_API_KEY']);
  assert.equal((await readFile('Procfile', 'utf8')).trim(), 'web: npm run start:hosted');
  const pkg = JSON.parse(await readFile('package.json', 'utf8'));
  assert.equal(pkg.scripts['heroku-postbuild'], 'npm run build'); assert.equal(pkg.engines.node, '22.x');
  assert.equal(pkg.bin['handigraphs-stats-api-mcp'], 'dist/index.js');
  const publish = await readFile('.github/workflows/publish.yml', 'utf8'); assert.ok(!publish.includes('deploy-mcp') && publish.includes('npm publish --access public'));
});

test('committed owner acceptance names exactly the accepted pair, record and client versions', async () => {
  const value = parseOwnerAcceptance((await readFile(OWNER_ACCEPTANCE_FILE, 'utf8')).replace(/\r\n/g, '\n'));
  assert.equal(value.owner, 'cjbuskey');
  assert.equal(value.tested_app_sha, '3dd38c3405d22d694d92e9bd076a8d4dfea87990');
  assert.equal(value.accepted_app_sha, 'b38cc79ebd71625ba93fe7f3e1fef20342a47c54');
  assert.equal(value.tested_mcp_sha, 'a2909a6e84d8b4ea5b30162f2999eeca0ef5a8ef');
  assert.equal(value.accepted_mcp_sha, '15a21d02c8e48239297e8316613537c88b15f017');
  assert.equal(value.record_sha256, '5fb155e793175bb6ce1f649ca7f0d10483ff224c14fa860406fbcdd4f4c144ec');
  assert.deepEqual(value.clients, { codex_desktop: '26.1016.61520', codex_cli: '0.163.0', claude_code: '2.1.283' });
});
test('owner acceptance is strict, canonical and owner-bound', () => {
  assert.doesNotThrow(() => parseOwnerAcceptance(serializeEvidence(acceptance())));
  for (const change of [{ owner: 'someone-else' }, { purpose: 'hosted-mcp-acceptance' }, { schema_version: 2 }, { tested_mcp_sha: 'main' },
    { accepted_mcp_sha: undefined }, { accepted_mcp_sha: 'E'.repeat(40) },
    { accepted_app_sha: app.slice(0, 7) }, { record_sha256: 'x'.repeat(64) }, { decided_on: '24/10/2026' }, { summary: '' },
    { summary: 'x'.repeat(1001) }, { token: 'synthetic-secret' }, { clients: { codex_cli: '0.163.0' } },
    { clients: { codex_desktop: '26.1016.61520', codex_cli: 'latest', claude_code: '2.1.283' } }]) {
    assert.throws(() => validateOwnerAcceptance(acceptance(change)));
  }
  assert.throws(() => parseOwnerAcceptance(JSON.stringify(acceptance(), null, 2)));
  assert.throws(() => parseOwnerAcceptance(serializeEvidence(acceptance()).replace('{', '{"owner":"someone-else",')));
  assert.throws(() => parseOwnerAcceptance('x'.repeat(20000)));
});
test('only non-runtime paths may differ from the accepted MCP commit', () => {
  for (const path of ['.github/workflows/deploy-mcp-prod.yml', 'docs/hosted-operations.md', 'plans/x.md', OWNER_ACCEPTANCE_FILE,
    'scripts/check-hosted-deploy.mjs', 'tests/hosted-deploy.test.ts', 'AGENTS.md', 'CLAUDE.md', 'README.md', 'CHANGELOG.md',
    'plugins/handigraphs-stats-api-hosted/.codex-plugin/plugin.json', '.agents/plugins/marketplace.json', '.claude-plugin/marketplace.json',
    'scripts/check-distributions.mjs', 'tests/hosted-distributions.test.ts']) assert.equal(nonRuntimePath(path), true);
  for (const path of ['src/hosted-index.ts', 'package.json', 'package-lock.json', 'Procfile', 'tsconfig.json', 'scripts/other.mjs',
    'tests/other.test.ts', 'runtime/configure-macos.mjs', 'mcpb/manifest.json', 'docs/../src/x.ts', 'plugins/../src/x.ts', '', undefined])
    assert.equal(nonRuntimePath(path), false);
  const ok = { status: 'ahead', behind_by: 0, total_commits: 2, files: [{ filename: 'docs/a.md' }] };
  assert.doesNotThrow(() => validateRuntimeComparison(ok));
  assert.doesNotThrow(() => validateRuntimeComparison({ status: 'identical', behind_by: 0, total_commits: 0, files: [] }));
  for (const change of [{ status: 'behind' }, { status: 'diverged' }, { behind_by: 1 }, { total_commits: 250 },
    { files: [{ filename: 'src/hosted-auth.ts' }] }, { files: [{ filename: 'package-lock.json' }] },
    { files: [{ filename: 'docs/moved.ts', previous_filename: 'src/moved.ts' }] }, { files: Array.from({ length: 300 }, () => ({ filename: 'docs/a.md' })) },
    { files: undefined }]) assert.throws(() => validateRuntimeComparison({ ...ok, ...change }));
});
test('owner acceptance gate binds app SHA, runtime comparison and an unmoved main', async () => {
  const { plane, calls } = fixture();
  assert.deepEqual(await plane.verifyOwnerAcceptance(env), { app_sha: app, mcp_sha: mcp, tested_mcp_sha: tested, accepted_mcp_sha: accepted,
    record_sha256: 'f'.repeat(64) });
  assert.ok(calls.every(call => (call.init?.method || 'GET') === 'GET' && !call.url.includes('/repos/cjbuskey/')));
  await assert.rejects(fixture().plane.verifyOwnerAcceptance({ ...env, APP_SHA: 'c'.repeat(40) }));
  await assert.rejects(fixture({ acceptance: '{}' }).plane.verifyOwnerAcceptance(env));
  await assert.rejects(fixture({ comparison: { status: 'ahead', behind_by: 0, total_commits: 1, files: [{ filename: 'src/hosted-index.ts' }] } })
    .plane.verifyOwnerAcceptance(env));
  await assert.rejects(fixture({ apiError: { path: '/compare/', status: 404 } }).plane.verifyOwnerAcceptance(env));
  let refs = 0;
  const moved = fixture({ mutate: (path, value) => path === '/repos/Handigraphs/handigraphs-stats-api-mcp/git/ref/heads/main' && ++refs === 2
    ? { object: { sha: 'f'.repeat(40) } } : value });
  await assert.rejects(moved.plane.verifyOwnerAcceptance(env));
  await assert.rejects(fixture().plane.verifyOwnerAcceptance({ ...env, DEPLOY_CONFIRM: 'yes' }));
  await assert.rejects(fixture().plane.verifyOwnerAcceptance({ ...env, GITHUB_RUN_ATTEMPT: '2' }));
});
test('a runtime change or missing environment approval never starts a production build', async () => {
  for (const change of [{ comparison: { status: 'ahead', behind_by: 0, total_commits: 1, files: [{ filename: 'package.json' }] } },
    { path: '/actions/runs/77/approvals', value: [] }, { acceptance: serializeEvidence(acceptance({ owner: 'someone-else' })) }]) {
    const { plane, calls } = fixture(change); await assert.rejects(plane.deploy(env));
    assert.equal(calls.some(call => call.init?.method === 'POST'), false);
  }
});
