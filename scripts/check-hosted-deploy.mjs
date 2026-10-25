// Deployment-only control plane. Never import application code or log API bodies.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';

export const MCP_REPO = 'Handigraphs/handigraphs-stats-api-mcp';
export const APP_REPO = 'cjbuskey/handigraphs-app';
export const EVIDENCE_WORKFLOW = 'hosted-mcp-oauth-evidence.yml';
export const EVIDENCE_ENVIRONMENT = 'hosted-mcp-evidence';
export const TARGETS = Object.freeze({
  sandbox: Object.freeze({ app: 'handigraphs-mcp-sandbox', origin: 'https://mcp-sandbox.handigraphs.com' }),
  production: Object.freeze({ app: 'handigraphs-mcp', origin: 'https://mcp.handigraphs.com' }),
});
const APP_SANDBOX = Object.freeze({ app: 'handigraphs-sandbox-web', origin: 'https://handigraphs-sandbox-web-49829810d1bb.herokuapp.com' });
const MAX_JSON = 256 * 1024;
const MAX_ARCHIVE = 64 * 1024;
const MAX_MANIFEST = 16 * 1024;
const FRESH_MS = 7 * 24 * 60 * 60 * 1000;
export const CHECKS = Object.freeze(['codex_desktop', 'codex_cli', 'claude_code', 'refresh', 'revocation', 'queued_job_revocation',
  'cross_user_isolation', 'shared_limits', 'rolling_worker', 'local_stdio', 'tool_refresh', 'capacity']);
// Owner decision 2026-10-24: production deploys require the owner's recorded acceptance
// of the completed sandbox acceptance plus a runtime identical to the accepted MCP commit,
// in place of a published same-pair evidence artifact. The accepted commit is the tested
// commit plus owner-approved non-breaking security updates. The production environment
// gate stays.
export const OWNER_ACCEPTANCE_FILE = 'deploy/owner-acceptance.json';
const OWNER_LOGIN = 'cjbuskey';
// Distribution-only paths (marketplaces, plugin manifests and skills) never ship in the gateway runtime.
const NON_RUNTIME_PREFIXES = Object.freeze(['.github/', 'docs/', 'plans/', 'plugins/', '.agents/plugins/', '.claude-plugin/']);
const NON_RUNTIME_FILES = Object.freeze(new Set([OWNER_ACCEPTANCE_FILE, 'scripts/check-hosted-deploy.mjs',
  'tests/hosted-deploy.test.ts', 'AGENTS.md', 'CLAUDE.md', 'README.md', 'CHANGELOG.md',
  'scripts/check-distributions.mjs', 'tests/hosted-distributions.test.ts']));
export function nonRuntimePath(value) {
  return typeof value === 'string' && value.length > 0 && !value.includes('..')
    && (NON_RUNTIME_FILES.has(value) || NON_RUNTIME_PREFIXES.some(prefix => value.startsWith(prefix)));
}
function requireThat(value) { if (!value) throw new Error('Hosted deployment gate failed. See the operations prerequisites.'); }
function sha(value) { return typeof value === 'string' && /^[a-f0-9]{40}$/.test(value); }
function id(value) { return Number.isSafeInteger(value) && value > 0; }
function keys(value, names) {
  requireThat(value && typeof value === 'object' && !Array.isArray(value));
  requireThat(Object.keys(value).sort().join(',') === [...names].sort().join(','));
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
export function evidenceDigest(manifest) {
  const { evidence_sha256: _digest, ...body } = manifest;
  return createHash('sha256').update(JSON.stringify(canonical(body))).digest('hex');
}
export function serializeEvidence(manifest) { return JSON.stringify(canonical(manifest)) + '\n'; }
export function approvalRequest(manifest, run) {
  return { schema_version: 1, purpose: 'hosted-mcp-acceptance', repository: APP_REPO, workflow: EVIDENCE_WORKFLOW,
    run_id: manifest.source.run_id, run_attempt: 1, app_sha: manifest.app_sha, mcp_sha: manifest.mcp_sha,
    review_sha256: manifest.approval.review_sha256, created_at: run.created_at };
}
export function approvalDigest(request) {
  return createHash('sha256').update(JSON.stringify(canonical(request))).digest('hex');
}
export function approvalIssueBody(request) {
  const digest = approvalDigest(request);
  return 'Hosted MCP acceptance approval requested. Review the private workflow summary and actual client/load/cleanup observations.\n\n```json\n'
    + JSON.stringify(canonical(request)) + '\n```\n\nOnly cjbuskey may approve. Comment exactly:\n\n`APPROVE ' + digest
    + '`\n\nTo reject, comment exactly:\n\n`REJECT ' + digest
    + '`\n\nApproval has a five-minute cooldown and must publish within 30 minutes of dispatch. Keep this issue open while the evidence is in use. Any rejection, edited reviewer comment, missing approval or changed request blocks publication and future use. Agents must never approve.\n';
}
export function validateIssueApproval(manifest, run, issue, comments, selected) {
  const proof = manifest.approval;
  const request = approvalRequest(manifest, run);
  const digest = approvalDigest(request);
  const dispatched = Date.parse(run.created_at), published = Date.parse(manifest.checked_at);
  requireThat(Number.isFinite(dispatched) && published <= dispatched + 1800000);
  requireThat(issue.number === proof.issue_number && issue.state === 'open' && !issue.pull_request
    && issue.user?.id === 41898282 && issue.user.type === 'Bot' && issue.body === approvalIssueBody(request));
  const opened = Date.parse(issue.created_at);
  requireThat(Number.isFinite(opened) && opened >= dispatched && opened <= published);
  requireThat(Array.isArray(comments) && comments.length < 100 && new Set(comments.map(item => item.id)).size === comments.length);
  const approved = [];
  for (const comment of comments) {
    requireThat(id(comment.id));
    if (comment.user?.id !== 39887731) continue;
    const time = Date.parse(comment.created_at);
    requireThat(comment.user.type === 'User' && comment.updated_at === comment.created_at && typeof comment.body === 'string'
      && Number.isFinite(time) && time >= opened && comment.body.trim() !== `REJECT ${digest}`);
    if (comment.body.trim() === `APPROVE ${digest}`) approved.push(comment);
  }
  approved.sort((a, b) => a.id - b.id);
  const latest = approved.at(-1);
  requireThat(latest && latest.id === proof.comment_id && Date.parse(latest.created_at) + 300000 <= published);
  // Re-fetch the pinned comment as well as the complete bounded history: deletion,
  // edits or a later approval must not be hidden by a stale manifest pointer.
  requireThat(selected.id === latest.id && selected.user?.id === 39887731 && selected.user.type === 'User'
    && selected.body === latest.body && selected.created_at === latest.created_at && selected.updated_at === latest.updated_at);
}
export function validateOwnerAcceptance(value) {
  keys(value, ['schema_version', 'purpose', 'owner', 'decided_on', 'tested_app_sha', 'accepted_app_sha', 'tested_mcp_sha',
    'accepted_mcp_sha', 'record_sha256', 'clients', 'summary']);
  requireThat(value.schema_version === 1 && value.purpose === 'hosted-mcp-owner-acceptance' && value.owner === OWNER_LOGIN);
  requireThat(typeof value.decided_on === 'string' && /^\d{4}-\d\d-\d\d$/.test(value.decided_on)
    && Number.isFinite(Date.parse(value.decided_on + 'T00:00:00Z')));
  requireThat(sha(value.tested_app_sha) && sha(value.accepted_app_sha) && sha(value.tested_mcp_sha) && sha(value.accepted_mcp_sha));
  requireThat(typeof value.record_sha256 === 'string' && /^[a-f0-9]{64}$/.test(value.record_sha256));
  keys(value.clients, ['codex_desktop', 'codex_cli', 'claude_code']);
  requireThat(Object.values(value.clients).every(version => typeof version === 'string'
    && /^[0-9]{1,10}(?:\.[0-9]{1,10}){1,3}(?:-(?:alpha|beta|rc)\.[0-9]{1,5})?$/.test(version)));
  requireThat(typeof value.summary === 'string' && value.summary.length > 0 && value.summary.length <= 1000);
  return value;
}
// One canonical serialization, like the evidence manifest: no duplicate or hidden keys.
export function parseOwnerAcceptance(text) {
  requireThat(typeof text === 'string' && text.length <= MAX_MANIFEST);
  const value = JSON.parse(text);
  requireThat(text === serializeEvidence(value));
  return validateOwnerAcceptance(value);
}
// The deployed MCP commit may differ from the accepted one only outside the runtime.
export function validateRuntimeComparison(comparison) {
  requireThat(comparison && (comparison.status === 'identical' || comparison.status === 'ahead') && comparison.behind_by === 0);
  requireThat(Number.isSafeInteger(comparison.total_commits) && comparison.total_commits >= 0 && comparison.total_commits < 250);
  requireThat(Array.isArray(comparison.files) && comparison.files.length < 300);
  requireThat(comparison.files.every(file => nonRuntimePath(file?.filename)
    && (file.previous_filename === undefined || nonRuntimePath(file.previous_filename))));
  return comparison;
}
export function validateRequest(env) {
  const target = env.DEPLOY_TARGET;
  requireThat(Object.hasOwn(TARGETS, target ?? '') && env.GITHUB_REPOSITORY === MCP_REPO);
  requireThat(env.GITHUB_REF === 'refs/heads/main' && sha(env.GITHUB_SHA) && env.GITHUB_RUN_ATTEMPT === '1');
  requireThat(sha(env.MCP_SHA) && env.MCP_SHA === env.GITHUB_SHA);
  if (target === 'production') {
    requireThat(env.GITHUB_EVENT_NAME === 'workflow_dispatch' && env.DEPLOY_CONFIRM === 'deploy-production' && sha(env.APP_SHA));
  } else {
    requireThat(env.HOSTED_SANDBOX_DEPLOY_ENABLED === 'true');
    requireThat(env.GITHUB_EVENT_NAME === 'push' || env.GITHUB_EVENT_NAME === 'workflow_dispatch' && env.DEPLOY_CONFIRM === 'deploy-sandbox');
  }
  return TARGETS[target];
}
export function validateManifest(manifest, pair, now = Date.now()) {
  keys(manifest, ['schema_version', 'app_sha', 'mcp_sha', 'checked_at', 'source', 'approval', 'sandbox', 'clients', 'checks', 'metrics', 'cleanup', 'evidence_sha256']);
  requireThat(manifest.schema_version === 2 && sha(manifest.app_sha) && sha(manifest.mcp_sha));
  requireThat(manifest.app_sha === pair.app_sha && manifest.mcp_sha === pair.mcp_sha);
  const time = Date.parse(manifest.checked_at);
  requireThat(typeof manifest.checked_at === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(manifest.checked_at)
    && time <= now && now - time <= FRESH_MS);
  keys(manifest.source, ['workflow', 'run_id', 'run_attempt']);
  requireThat(manifest.source.workflow === EVIDENCE_WORKFLOW && id(manifest.source.run_id) && manifest.source.run_attempt === 1);
  keys(manifest.approval, ['method', 'issue_number', 'comment_id', 'review_sha256']);
  requireThat(manifest.approval.method === 'github_issue_v1' && id(manifest.approval.issue_number) && id(manifest.approval.comment_id)
    && typeof manifest.approval.review_sha256 === 'string' && /^[a-f0-9]{64}$/.test(manifest.approval.review_sha256));
  keys(manifest.sandbox, ['app_release', 'mcp_release']);
  requireThat(Object.values(manifest.sandbox).every(value => typeof value === 'string' && /^v[1-9][0-9]{0,8}$/.test(value)));
  keys(manifest.clients, ['codex_desktop', 'codex_cli', 'claude_code']);
  requireThat(Object.values(manifest.clients).every(value => typeof value === 'string'
    && /^[0-9]{1,10}(?:\.[0-9]{1,10}){1,3}(?:-(?:alpha|beta|rc)\.[0-9]{1,5})?$/.test(value)));
  keys(manifest.checks, CHECKS);
  requireThat(Object.values(manifest.checks).every(value => value === 'passed') && manifest.cleanup === true);
  keys(manifest.metrics, ['duration_seconds', 'requests_per_second', 'concurrency', 'added_p95_ms', 'unexpected_429', 'unexpected_503']);
  const metrics = manifest.metrics;
  requireThat(Object.values(metrics).every(value => Number.isSafeInteger(value) && value >= 0));
  requireThat(Number.isInteger(metrics.duration_seconds) && Number.isInteger(metrics.concurrency)
    && metrics.duration_seconds >= 300 && metrics.duration_seconds <= 3600 && metrics.requests_per_second >= 5
    && metrics.requests_per_second <= 10 && metrics.concurrency >= 10 && metrics.concurrency <= 20
    && metrics.added_p95_ms < 500 && metrics.unexpected_429 === 0 && metrics.unexpected_503 === 0);
  requireThat(/^[a-f0-9]{64}$/.test(manifest.evidence_sha256) && evidenceDigest(manifest) === manifest.evidence_sha256);
  return manifest;
}
// One small regular JSON member; never extract paths or execute archive contents.
export function readEvidenceZip(bytes) {
  requireThat(bytes.length >= 22 && bytes.length <= MAX_ARCHIVE);
  const end = bytes.length - 22;
  requireThat(bytes.readUInt32LE(end) === 0x06054b50 && bytes.readUInt16LE(end + 4) === 0 && bytes.readUInt16LE(end + 6) === 0
    && bytes.readUInt16LE(end + 8) === 1 && bytes.readUInt16LE(end + 10) === 1 && bytes.readUInt16LE(end + 20) === 0);
  const offset = bytes.readUInt32LE(end + 16);
  requireThat(offset + 46 <= end && bytes.readUInt32LE(offset) === 0x02014b50);
  const method = bytes.readUInt16LE(offset + 10);
  const compressed = bytes.readUInt32LE(offset + 20);
  const length = bytes.readUInt32LE(offset + 24);
  const nameLength = bytes.readUInt16LE(offset + 28);
  const local = bytes.readUInt32LE(offset + 42);
  requireThat((method === 0 || method === 8) && !(bytes.readUInt16LE(offset + 8) & 1) && length > 0 && length <= MAX_MANIFEST);
  requireThat(bytes.subarray(offset + 46, offset + 46 + nameLength).toString('utf8') === 'evidence.json');
  requireThat((bytes.readUInt32LE(offset + 38) >>> 16 & 0xf000) !== 0xa000 && local + 30 <= offset && bytes.readUInt32LE(local) === 0x04034b50);
  requireThat(bytes.readUInt16LE(local + 8) === method && !(bytes.readUInt16LE(local + 6) & 1));
  const localNameLength = bytes.readUInt16LE(local + 26);
  requireThat(bytes.subarray(local + 30, local + 30 + localNameLength).toString('utf8') === 'evidence.json');
  const start = local + 30 + localNameLength + bytes.readUInt16LE(local + 28);
  requireThat(start + compressed <= offset);
  const encoded = bytes.subarray(start, start + compressed);
  const decoded = method === 0 ? encoded : inflateRawSync(encoded, { maxOutputLength: MAX_MANIFEST });
  requireThat(decoded.length === length);
  const text = decoded.toString('utf8');
  const value = JSON.parse(text);
  // A single canonical serialization rejects duplicate/hidden keys, malformed
  // UTF-8, incidental dumps and alternate representations before validation.
  requireThat(text === serializeEvidence(value));
  return value;
}
async function bounded(response, maximum) {
  requireThat(Number(response.headers.get('content-length') || 0) <= maximum);
  const reader = response.body?.getReader(); requireThat(reader);
  let size = 0; const parts = [];
  try {
    for (;;) { const item = await reader.read(); if (item.done) break; size += item.value.length; requireThat(size <= maximum); parts.push(item.value); }
    return Buffer.concat(parts);
  } finally { await reader.cancel().catch(() => {}); }
}
export function createControlPlane(fetchImpl = fetch, timing = {}, options = {}) {
  const clock = timing.now ?? Date.now;
  // Windows checkouts may convert line endings; the canonical check applies to LF text.
  const readAcceptance = options.readAcceptance ?? (() => readFileSync(OWNER_ACCEPTANCE_FILE, 'utf8').replace(/\r\n/g, '\n'));
  const pause = timing.sleep ?? (milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)));
  async function request(url, token, { method = 'GET', body, raw = false, maximum = MAX_JSON, extraHeaders = {} } = {}) {
    const signal = AbortSignal.timeout(15000);
    const headers = { Accept: url.startsWith('https://api.heroku.com/') ? 'application/vnd.heroku+json; version=3' : 'application/vnd.github+json', ...extraHeaders };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body) headers['Content-Type'] = 'application/json';
    const response = await fetchImpl(url, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}), redirect: 'manual', signal });
    if (raw) return response;
    requireThat(response.ok);
    return JSON.parse((await bounded(response, maximum)).toString('utf8'));
  }
  const github = (repo, path, token) => request(`https://api.github.com/repos/${repo}${path ? '/' + path : ''}`, token);
  const heroku = (app, path, token, options) => request(`https://api.heroku.com/apps/${app}/${path}`, token, options);
  async function requireMain(env) {
    validateRequest(env);
    const ref = await github(MCP_REPO, 'git/ref/heads/main', env.GH_TOKEN);
    requireThat(ref.object?.sha === env.MCP_SHA);
  }
  async function approved(repo, runId, environment, token) {
    requireThat(id(runId));
    const reviews = await github(repo, `actions/runs/${runId}/approvals`, token);
    requireThat(Array.isArray(reviews));
    const matching = reviews.filter(review => review.environments?.some(item => item.name === environment));
    requireThat(matching.length > 0 && matching.every(review => review.state === 'approved' && review.user?.type === 'User'));
  }
  async function release(app, token) {
    requireThat(token);
    const releases = await heroku(app, 'releases', token, { extraHeaders: { Range: 'version ..; order=desc,max=1' } });
    requireThat(Array.isArray(releases) && releases.length > 0);
    const latest = [...releases].sort((a, b) => b.version - a.version)[0];
    requireThat(latest.status === 'succeeded' && id(latest.version) && /^[a-f0-9-]{36}$/.test(latest.slug?.id));
    const slug = await heroku(app, `slugs/${latest.slug.id}`, token);
    requireThat(sha(slug.commit));
    return { version: `v${latest.version}`, sha: slug.commit };
  }
  async function healthy(origin, backend = false) {
    const result = await request(origin + '/health/ready');
    requireThat(backend ? result.status === 'ok' && result.db === 'ok' && result.redis === 'ok' : result.ready === true && result.stateless === true);
  }
  async function currentIssueApproval(manifest, run, token) {
    const issue = await github(APP_REPO, `issues/${manifest.approval.issue_number}`, token);
    const response = await request(`https://api.github.com/repos/${APP_REPO}/issues/${manifest.approval.issue_number}/comments?per_page=100`, token, { raw: true });
    requireThat(response.ok && !response.headers.has('link'));
    const comments = JSON.parse((await bounded(response, MAX_JSON)).toString('utf8'));
    const selected = await github(APP_REPO, `issues/comments/${manifest.approval.comment_id}`, token);
    validateIssueApproval(manifest, run, issue, comments, selected);
  }
  async function verifyEvidence(env) {
    await requireMain(env);
    requireThat(env.DEPLOY_TARGET === 'production' && env.APP_EVIDENCE_TOKEN && env.HEROKU_SANDBOX_READ_API_KEY);
    const token = env.APP_EVIDENCE_TOKEN;
    const repository = await github(APP_REPO, '', token);
    requireThat(repository.full_name === APP_REPO && repository.private === true && id(repository.id));
    const appMain = await github(APP_REPO, 'git/ref/heads/main', token);
    requireThat(appMain.object?.sha === env.APP_SHA);
    const workflow = await github(APP_REPO, `actions/workflows/${EVIDENCE_WORKFLOW}`, token);
    requireThat(id(workflow.id) && workflow.path === `.github/workflows/${EVIDENCE_WORKFLOW}` && workflow.state === 'active');
    const listed = await github(APP_REPO, `actions/workflows/${workflow.id}/runs?head_sha=${env.APP_SHA}&branch=main&event=workflow_dispatch&status=success&per_page=20`, token);
    requireThat(Array.isArray(listed.workflow_runs) && listed.workflow_runs.length > 0);
    const runId = listed.workflow_runs[0].id; requireThat(id(runId));
    const run = await github(APP_REPO, `actions/runs/${runId}`, token);
    requireThat(run.workflow_id === workflow.id && run.path === workflow.path && run.event === 'workflow_dispatch'
      && run.head_branch === 'main' && run.head_sha === env.APP_SHA && run.repository?.id === repository.id
      && run.head_repository?.id === repository.id && run.status === 'completed' && run.conclusion === 'success' && run.run_attempt === 1);
    const time = Date.parse(run.updated_at);
    requireThat(Number.isFinite(time) && time <= Date.now() && Date.now() - time <= FRESH_MS);
    const artifacts = await github(APP_REPO, `actions/runs/${runId}/artifacts?per_page=100`, token);
    requireThat(artifacts.total_count <= 100 && Array.isArray(artifacts.artifacts));
    const matches = artifacts.artifacts.filter(item => item.name === 'hosted-mcp-oauth-acceptance');
    requireThat(matches.length === 1);
    const artifact = matches[0];
    requireThat(id(artifact.id) && artifact.expired === false && artifact.size_in_bytes > 0 && artifact.size_in_bytes <= MAX_ARCHIVE
      && /^sha256:[a-f0-9]{64}$/.test(artifact.digest) && artifact.workflow_run?.id === runId
      && artifact.workflow_run.repository_id === repository.id && artifact.workflow_run.head_repository_id === repository.id
      && artifact.workflow_run.head_branch === 'main' && artifact.workflow_run.head_sha === env.APP_SHA);
    const response = await request(`https://api.github.com/repos/${APP_REPO}/actions/artifacts/${artifact.id}/zip`, token, { raw: true });
    requireThat(response.status === 302);
    const location = new URL(response.headers.get('location'));
    requireThat(location.protocol === 'https:' && !location.username && !location.password && !location.hash
      && (location.hostname.endsWith('.blob.core.windows.net') || location.hostname.endsWith('.actions.githubusercontent.com')));
    // GitHub's signed blob URL is followed exactly once, WITHOUT Authorization.
    const blob = await request(location.href, undefined, { raw: true });
    requireThat(blob.ok);
    const bytes = await bounded(blob, MAX_ARCHIVE);
    requireThat('sha256:' + createHash('sha256').update(bytes).digest('hex') === artifact.digest);
    const manifest = validateManifest(readEvidenceZip(bytes), { app_sha: env.APP_SHA, mcp_sha: env.MCP_SHA });
    requireThat(manifest.source.run_id === runId && Date.parse(manifest.checked_at) >= Date.parse(run.created_at)
      && Date.parse(manifest.checked_at) <= time);
    await currentIssueApproval(manifest, run, token);
    const appRelease = await release(APP_SANDBOX.app, env.HEROKU_SANDBOX_READ_API_KEY);
    const mcpRelease = await release(TARGETS.sandbox.app, env.HEROKU_SANDBOX_READ_API_KEY);
    requireThat(appRelease.sha === env.APP_SHA && mcpRelease.sha === env.MCP_SHA
      && appRelease.version === manifest.sandbox.app_release && mcpRelease.version === manifest.sandbox.mcp_release);
    await healthy(APP_SANDBOX.origin, true); await healthy(TARGETS.sandbox.origin);
    await requireMain(env);
    const currentAppMain = await github(APP_REPO, 'git/ref/heads/main', token);
    requireThat(currentAppMain.object?.sha === env.APP_SHA);
    await currentIssueApproval(manifest, run, token); // Reject a decision changed during release/health reads.
    // Only public source pair + digest may leave this process; private provenance stays private.
    return { app_sha: env.APP_SHA, mcp_sha: env.MCP_SHA, evidence_sha256: manifest.evidence_sha256 };
  }
  async function verifyOwnerAcceptance(env) {
    await requireMain(env);
    requireThat(env.DEPLOY_TARGET === 'production');
    const acceptance = parseOwnerAcceptance(readAcceptance());
    requireThat(env.APP_SHA === acceptance.accepted_app_sha);
    validateRuntimeComparison(await github(MCP_REPO, `compare/${acceptance.accepted_mcp_sha}...${env.MCP_SHA}`, env.GH_TOKEN));
    await requireMain(env); // Main must not move while the comparison was read.
    return { app_sha: env.APP_SHA, mcp_sha: env.MCP_SHA, tested_mcp_sha: acceptance.tested_mcp_sha,
      accepted_mcp_sha: acceptance.accepted_mcp_sha, record_sha256: acceptance.record_sha256 };
  }
  async function deploy(env) {
    const target = validateRequest(env);
    await requireMain(env);
    if (env.DEPLOY_TARGET === 'production') {
      await approved(MCP_REPO, Number(env.GITHUB_RUN_ID), 'production', env.GH_TOKEN);
      await verifyOwnerAcceptance(env); // Recheck after the approval wait.
    }
    requireThat(env.HEROKU_DEPLOY_API_KEY);
    const result = await heroku(target.app, 'builds', env.HEROKU_DEPLOY_API_KEY, { method: 'POST', body: {
      source_blob: { url: `https://github.com/${MCP_REPO}/archive/${env.MCP_SHA}.tar.gz`, version: env.MCP_SHA },
    } });
    requireThat(/^[a-f0-9-]{36}$/.test(result.id));
    const deadline = clock() + 8 * 60 * 1000;
    while (clock() < deadline) {
      const build = await heroku(target.app, `builds/${result.id}`, env.HEROKU_DEPLOY_API_KEY);
      if (build.status === 'successful' || build.status === 'succeeded') {
        const current = await release(target.app, env.HEROKU_DEPLOY_API_KEY);
        requireThat(current.sha === env.MCP_SHA);
        const readyDeadline = clock() + 90000;
        while (clock() < readyDeadline) {
          try { await healthy(target.origin); return; } catch { /* Bounded read-only readiness polling, no build retry. */ }
          await pause(3000);
        }
        requireThat(false);
      }
      requireThat(build.status === 'pending');
      await pause(10000);
    }
    requireThat(false);
  }
  return { requireMain, verifyEvidence, verifyOwnerAcceptance, deploy };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const plane = createControlPlane();
  const mode = process.argv[2];
  Promise.resolve().then(async () => {
    requireThat(process.argv.length === 3 && ['request', 'acceptance', 'deploy'].includes(mode));
    if (mode === 'request') await plane.requireMain(process.env);
    else if (mode === 'acceptance') console.log(JSON.stringify(await plane.verifyOwnerAcceptance(process.env)));
    else await plane.deploy(process.env);
  }).catch(() => { console.error('Hosted deployment blocked: required source, approval, owner acceptance, access or health check failed.'); process.exitCode = 1; });
}
