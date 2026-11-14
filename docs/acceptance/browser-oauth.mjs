// Operator-only fixed-sandbox acceptance. JSON credentials arrive on stdin, never argv/files.
// No traces, HAR, storageState, screenshots, response bodies or secrets are retained.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { auth, refreshAuthorization } from '@modelcontextprotocol/sdk/client/auth.js';

const ISSUER = 'https://handigraphs-sandbox-web-49829810d1bb.herokuapp.com';
const RESOURCE = 'https://mcp-sandbox.handigraphs.com/mcp';
let stage = 'input', browser, callback;
const clients = [], results = [], statuses = [];
let closing;
async function cleanupClient() {
  closing ??= (async () => {
    for (const client of clients) await client.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
    if (callback) await new Promise(resolve => callback.close(resolve));
    if (process.connected) process.disconnect();
  })();
  return closing;
}
process.on('message', message => {
  if (message?.event === 'abort') void cleanupClient().finally(() => process.exit(1));
});
process.on('disconnect', () => {
  if (!closing) void cleanupClient().finally(() => process.exit(1));
});
function check(value) { assert.ok(value, 'acceptance assertion failed'); }
function report(name, details = {}) { results.push({ name, ...details }); }
async function safeFetch(input, init) {
  const url = new URL(input instanceof Request ? input.url : input);
  check([ISSUER, new URL(RESOURCE).origin].includes(url.origin));
  const response = await fetch(input, { ...init, redirect: 'error', signal: AbortSignal.timeout(20000) });
  statuses.push({ kind: url.pathname.startsWith('/oauth/') ? 'oauth' : 'mcp', status: response.status });
  return response;
}
function unpack(result) {
  check(!result.isError && Array.isArray(result.content) && result.content.length === 1);
  check(result.content[0].type === 'text');
  return JSON.parse(result.content[0].text);
}
async function connect(provider) {
  const client = new Client({ name: 'slate-browser-acceptance', version: '1.0.0' });
  const transport = new StreamableHTTPClientTransport(new URL(RESOURCE), { authProvider: provider, fetch: safeFetch });
  await client.connect(transport);
  clients.push(client);
  return client;
}
async function main() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  check(input.confirm === 'ACCEPT_NHL_SLATE_SANDBOX' && /^mcp_slate_[a-f0-9]{32}$/.test(input.marker));
  check(/^\d{4}-\d\d-\d\d$/.test(input.date));
  stage = 'browser_launch';
  const { chromium } = await import(pathToFileURL(process.env.HANDIGRAPHS_PLAYWRIGHT_MODULE).href);
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(25000);
  stage = 'website_login_navigation';
  await page.goto(ISSUER + '/login', { waitUntil: 'domcontentloaded' });
  stage = 'website_login_email';
  await page.getByLabel('Email Address').fill(input.email);
  stage = 'website_login_password';
  await page.getByLabel('Password').fill(input.password);
  stage = 'website_login_submit';
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  stage = 'website_login_redirect';
  await page.waitForURL(url => url.origin === ISSUER && url.pathname !== '/login');
  report('website_browser_login', { browser: browser.version() });

  let resolveCode, rejectCode, expectedState, callbackUsed = false;
  callback = createServer((request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    if (url.pathname === '/complete') {
      response.writeHead(200, { 'content-type': 'text/plain', 'cache-control': 'no-store' });
      response.end('Sandbox acceptance connection complete.'); return;
    }
    try {
      check(request.method === 'GET' && url.pathname === '/callback' && !callbackUsed);
      check(url.searchParams.getAll('state').length === 1 && url.searchParams.get('state') === expectedState);
      check(url.searchParams.getAll('iss').length === 1 && url.searchParams.get('iss') === ISSUER);
      check(!url.searchParams.has('error') && url.searchParams.getAll('code').length === 1);
      const code = url.searchParams.get('code'); check(code?.length > 10);
      callbackUsed = true;
      response.writeHead(303, { location: '/complete', 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' });
      response.end(); resolveCode(code);
    } catch {
      response.writeHead(400); response.end(); rejectCode(new Error('invalid_callback'));
    }
  });
  await new Promise(resolve => callback.listen(0, '127.0.0.1', resolve));
  const redirect = `http://127.0.0.1:${callback.address().port}/callback`;
  let info, tokens, verifier, discovery, authorization;
  expectedState = randomBytes(32).toString('base64url');
  const clientName = input.marker;
  const provider = {
    redirectUrl: redirect,
    clientMetadata: { client_name: clientName, redirect_uris: [redirect],
      grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'],
      token_endpoint_auth_method: 'none', scope: 'stats:read' },
    state: () => expectedState,
    clientInformation: () => info, saveClientInformation: value => { info = value; },
    tokens: () => tokens, saveTokens: value => { tokens = value; },
    codeVerifier: () => verifier, saveCodeVerifier: value => { verifier = value; },
    discoveryState: () => discovery, saveDiscoveryState: value => { discovery = value; },
    redirectToAuthorization: value => { authorization = value; },
  };
  stage = 'oauth_discovery_registration';
  check(await auth(provider, { serverUrl: RESOURCE, scope: 'stats:read', fetchFn: safeFetch }) === 'REDIRECT');
  check(discovery.authorizationServerUrl === ISSUER && discovery.authorizationServerMetadata.issuer === ISSUER);
  check(discovery.authorizationServerMetadata.token_endpoint === ISSUER + '/oauth/token');
  check(discovery.resourceMetadata.resource === RESOURCE);
  check(authorization.origin === ISSUER && authorization.pathname === '/oauth/authorize');
  const codePromise = new Promise((resolve, reject) => { resolveCode = resolve; rejectCode = reject; });
  const timeout = setTimeout(() => rejectCode(new Error('callback_timeout')), 60000);
  stage = 'browser_consent';
  await page.goto(authorization.href, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: clientName, exact: true }).waitFor();
  await page.getByRole('button', { name: 'Connect', exact: true }).click();
  const code = await codePromise.finally(() => clearTimeout(timeout));
  await page.waitForURL(url => url.pathname === '/complete' && !url.search);
  const authorizer = new StreamableHTTPClientTransport(new URL(RESOURCE), { authProvider: provider, fetch: safeFetch });
  stage = 'authorization_code_exchange';
  await authorizer.finishAuth(code);
  check(tokens.issuer === ISSUER && tokens.scope === 'stats:read' && tokens.refresh_token);
  report('real_browser_consent_pkce_state_issuer');

  stage = 'fresh_client_catalog';
  const client = await connect(provider);
  const catalog = (await client.listTools()).tools;
  const briefTool = catalog.find(tool => tool.name === 'get_slate_brief');
  const evidenceTool = catalog.find(tool => tool.name === 'get_player_prop_evidence');
  check(briefTool && evidenceTool && evidenceTool.inputSchema.properties.sections.items.type === 'string');
  const sectionSchema = evidenceTool.inputSchema.properties.sections.items;
  check(['enum', 'const', 'oneOf', 'anyOf', 'allOf'].every(key => !(key in sectionSchema)));
  if (input.cohort_barrier === true) {
    check(typeof process.send === 'function');
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('cohort_barrier_timeout')), 60000);
      process.once('message', message => {
        clearTimeout(timeout);
        if (message?.event === 'go') resolve(); else reject(new Error('invalid_cohort_signal'));
      });
      process.send({ event: 'ready' });
    });
  }
  // This must be the first protected stats read; never REST-warm the endpoint.
  stage = 'cold_first_mcp_slate';
  const firstStarted = performance.now();
  const slateResult = await client.callTool({ name: 'get_slate_brief', arguments: { sport: 'nhl', date: input.date } });
  const firstLatencyMs = Math.ceil(performance.now() - firstStarted);
  if (input.cohort_barrier === true) {
    const cold = unpack(slateResult);
    report('cohort_cold', { latency_ms: firstLatencyMs, bytes: Buffer.byteLength(JSON.stringify(slateResult)),
      cache: cold.coverage?.input_cache ?? {}, selection_status: cold.coverage?.selection_status });
    for (let i = 0; i < 3; i++) {
      const warmStarted = performance.now();
      const result = await client.callTool({ name: 'get_slate_brief', arguments: { sport: 'nhl', date: input.date } });
      check(unpack(result).games.length === input.game_count);
      report('cohort_warm', { latency_ms: Math.ceil(performance.now()-warmStarted),
        bytes: Buffer.byteLength(JSON.stringify(result)) });
    }
  }
  const descriptor = unpack(await client.callTool({ name: 'describe_resource', arguments: { sport: 'nhl', resource: 'skaters' } }));
  check(descriptor.prop_evidence.sections.includes('matchup') && descriptor.prop_evidence.sections.includes('opponent_recent'));
  check(descriptor.mcp.tool_catalog_revision === 'nhl-research-v2' && descriptor.mcp.api_contract_version === '1.24.0');
  check(descriptor.slate_brief.formats.includes('compact_v2'));
  check(descriptor.mcp.prop_evidence_tool && descriptor.mcp.slate_brief_tool);
  check(descriptor.mcp.invocable_prop_evidence_sections.length === 5);
  const expectedBuild = process.env.HANDIGRAPHS_EXPECTED_MCP_SHA;
  check(/^[a-f0-9]{40}$/.test(expectedBuild));
  if (descriptor.mcp.build_sha !== null) check(descriptor.mcp.build_sha === expectedBuild);
  report('fresh_client_catalog', { tools: catalog.length, sections: descriptor.prop_evidence.sections,
    runtime: descriptor.mcp });
  stage = 'full_slate_read';
  const slate = unpack(slateResult), bytes = Buffer.byteLength(JSON.stringify(slateResult));
  check(slate.schema === 'nhl-slate-brief-v2');
  check(bytes <= 32768 && slate.games.length === input.game_count && slate.coverage.returned <= 12);
  check(slate.coverage.selection_status !== 'unavailable');
  check(slate.coverage.returned > 0 || slate.coverage.eligible === 0);
  report('cold_first_mcp_slate', { bytes, latency_ms: firstLatencyMs, coverage: slate.coverage,
    markets: slate.groups.map(group => ({ market: group.market, returned: group.candidates.length,
      eligible: group.eligible, exclusions: group.exclusions })) });
  stage = 'evidence_sections';
  const shots = slate.groups.find(group => group.market === 'skater_shots_on_goal');
  const candidate = shots?.candidates[0] ?? slate.groups.find(group => group.candidates.length)?.candidates[0];
  // An empty qualified slate is valid. A separate real-player screen can test
  // section invocability without manufacturing a candidate, line or usable quote.
  let selector = candidate?.evidence ?? input.evidence_selector;
  if (!selector) {
    const screen = unpack(await client.callTool({ name: 'query_stats', arguments: {
      sport: 'nhl', resource: 'skaters', day: 'today', split: 'L10',
      metrics: ['sog_per_game', 'icf_per_game', 'games_played'], sort: '-sog_per_game',
      page_size: 12, prop_screen: true, stat_format: 'compact', matchup_market: 'shots', matchup_window: 'sea' } }));
    const id = screen.data?.[0]?.entity?.id;
    check(typeof id === 'string' && /^[1-9][0-9]*$/.test(id));
    selector = { market: 'skater_shots_on_goal', player_ids: [id] };
    report('empty_qualified_slate_screen_fallback', { candidate_count: 0 });
  }
  const evidenceResult = await client.callTool({ name: 'get_player_prop_evidence', arguments: {
    ...selector, include_season: true, sections: ['hit_rates', 'game_logs', 'odds', 'matchup', 'opponent_recent'] } });
  const evidence = unpack(evidenceResult);
  const evidenceRows = evidence.data ?? evidence.result?.data;
  check(evidenceRows?.length === 1 && ['matchup', 'opponent_recent'].every(key => key in evidenceRows[0]));
  check(evidence.schema === 'nhl-prop-evidence-v1' && evidence.market === selector.market);
  check(evidence.slate_date === slate.slate_date && evidence.season === slate.season && evidence.game_type === 2);
  if (candidate) {
  check(evidenceRows[0].player_id === candidate.player_id && evidenceRows[0].line === candidate.line);
  for (const [side, rate] of [[candidate.side, candidate.recent]]) {
    const observed = evidenceRows[0].hit_rates.recent[side];
    check(observed.hits === rate.hits && observed.misses === rate.misses && observed.hit_rate === rate.hit_rate);
    check(observed.sample_size === candidate.recent.sample_size);
    const baseline = evidenceRows[0].hit_rates.season[side];
    check(baseline.hits === candidate.season.hits && baseline.sample_size === candidate.season.sample_size);
    const quote = evidenceRows[0].odds[side], age = Date.now() - Date.parse(quote.fetched_at);
    check(quote.status === 'available' && quote.game_id === candidate.league_game_id);
    check(quote.source_market_key === candidate.quote.source_market_key && age >= 0 && age <= 45 * 60 * 1000);
  }
  }
  report('advertised_evidence_sections_invocable', { bytes: Buffer.byteLength(JSON.stringify(evidenceResult)) });
  stage = 'refresh_rotation';
  const oldRefresh = tokens.refresh_token;
  for (let generation = 0; generation < 2; generation++) {
    const previous = tokens;
    const next = await refreshAuthorization(discovery.authorizationServerUrl, {
      metadata: discovery.authorizationServerMetadata, clientInformation: info,
      refreshToken: previous.refresh_token, resource: discovery.resourceMetadata.resource, fetchFn: safeFetch,
    });
    check(next.refresh_token !== previous.refresh_token && next.access_token !== previous.access_token);
    provider.saveTokens({ ...next, issuer: ISSUER });
    const fresh = await connect(provider);
    const result = await fresh.callTool({ name: 'get_slate_brief', arguments: {
      sport: 'nhl', date: input.date, markets: ['skater_shots_on_goal'], candidate_limit: 1 } });
    check(unpack(result).games.length === input.game_count);
    await fresh.close();
  }
  report('refresh_rotation', { generations: 2, fresh_connections: 2 });
  const frozenAccess = tokens.access_token;
  stage = 'browser_revocation';
  await page.goto(ISSUER + '/account/api', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: `Revoke connection to ${clientName}`, exact: true }).click();
  await page.getByRole('button', { name: 'Revoke app', exact: true }).click();
  await page.getByText('Connection revoked.', { exact: false }).waitFor();
  stage = 'completed_revocation_denial';
  const deniedStatuses = [];
  const frozen = new Client({ name: 'frozen-token-denial', version: '1.0.0' });
  clients.push(frozen);
  let denied = false;
  try {
    await frozen.connect(new StreamableHTTPClientTransport(new URL(RESOURCE), {
      requestInit: { headers: { Authorization: `Bearer ${frozenAccess}` } },
      fetch: async (url, init) => { const response = await safeFetch(url, init); deniedStatuses.push(response.status); return response; },
    }));
  } catch { denied = true; }
  check(denied && deniedStatuses.includes(401));
  report('browser_revocation_completed_gateway_401');
  stage = 'revoked_refresh_denial';
  let refreshDenied = false;
  try {
    await refreshAuthorization(discovery.authorizationServerUrl, { metadata: discovery.authorizationServerMetadata,
      clientInformation: info, refreshToken: tokens.refresh_token, resource: RESOURCE, fetchFn: safeFetch });
  } catch (error) { refreshDenied = error.constructor.name === 'InvalidGrantError'; }
  check(refreshDenied);
  // Consumed refresh is tested only after independent UI revocation, without relabeling it as reuse detection.
  check(oldRefresh !== tokens.refresh_token);
  report('revoked_refresh_invalid_grant');
  return { passed: true, results, statuses, client_ids: [info.client_id], sdk: '1.32.1' };
}
let output;
try { output = await main(); }
catch (error) { output = { passed: false, stage, failure_class: error.constructor.name, results, statuses }; process.exitCode = 1; }
finally {
  await cleanupClient();
}
process.stdout.write(JSON.stringify(output) + '\n');
