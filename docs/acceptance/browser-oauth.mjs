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
  check(['cursor', 'include_context', 'pregame_only', 'view'].every(key => key in briefTool.inputSchema.properties));
  check('include_current_offers' in catalog.find(tool => tool.name === 'get_gamecenter_packet').inputSchema.properties);
  const briefArguments = { sport: 'nhl', date: input.date, pregame_only: false, view: 'shortlist', candidate_limit: 10 };
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
  const slateResult = await client.callTool({ name: 'get_slate_brief', arguments: briefArguments });
  const firstLatencyMs = Math.ceil(performance.now() - firstStarted);
  if (slateResult.isError) {
    const problem = slateResult.structuredContent?.error ?? {};
    report('first_slate_error', { status: Number.isSafeInteger(problem.status) ? problem.status : null,
      code: typeof problem.code === 'string' && /^[a-z_]{1,64}$/.test(problem.code) ? problem.code : null });
  }
  if (input.cohort_barrier === true) {
    const cold = unpack(slateResult);
    report('cohort_cold', { latency_ms: firstLatencyMs, bytes: Buffer.byteLength(JSON.stringify(slateResult)),
      cache: cold.coverage?.input_cache ?? {}, selection_status: cold.coverage?.selection_status });
    for (let i = 0; i < 3; i++) {
      const warmStarted = performance.now();
      const result = await client.callTool({ name: 'get_slate_brief', arguments: briefArguments });
      check(unpack(result).games.length === input.game_count);
      report('cohort_warm', { latency_ms: Math.ceil(performance.now()-warmStarted),
        bytes: Buffer.byteLength(JSON.stringify(result)) });
    }
  }
  const descriptor = unpack(await client.callTool({ name: 'describe_resource', arguments: { sport: 'nhl', resource: 'skaters' } }));
  check(descriptor.prop_evidence.sections.includes('matchup') && descriptor.prop_evidence.sections.includes('opponent_recent'));
  const expectedContract = process.env.HANDIGRAPHS_EXPECTED_API_CONTRACT ?? '1.26.0';
  check(/^\d+\.\d+\.\d+$/.test(expectedContract));
  check(descriptor.mcp.tool_catalog_revision === 'nhl-ranked-shortlist-v1' && descriptor.mcp.api_contract_version === expectedContract);
  check(descriptor.slate_brief.formats.includes('compact_v4'));
  check(descriptor.mcp.prop_evidence_tool && descriptor.mcp.slate_brief_tool);
  check(descriptor.mcp.invocable_prop_evidence_sections.length === 5);
  const expectedBuild = process.env.HANDIGRAPHS_EXPECTED_MCP_SHA;
  check(/^[a-f0-9]{40}$/.test(expectedBuild));
  if (descriptor.mcp.build_sha !== null) check(descriptor.mcp.build_sha === expectedBuild);
  report('fresh_client_catalog', { tools: catalog.length, sections: descriptor.prop_evidence.sections,
    runtime: descriptor.mcp });
  stage = 'full_slate_read';
  const slate = unpack(slateResult), bytes = Buffer.byteLength(JSON.stringify(slateResult));
  check(slate.schema === 'nhl-slate-brief-v4');
  check(bytes <= 32768 && slate.scope.included_games === input.game_count);
  check(slate.view === 'shortlist' && !slate.context_included && slate.games.length === 0);
  check(slate.coverage.returned === Math.min(10, slate.coverage.eligible) && !slate.coverage.byte_limited);
  check(slate.coverage.selection_status !== 'unavailable');
  check(slate.coverage.returned > 0 || slate.coverage.eligible === 0 || slate.next_cursor);
  report('cold_first_mcp_slate', { bytes, latency_ms: firstLatencyMs, coverage: slate.coverage,
    markets: slate.groups.map(group => ({ market: group.market, returned: group.returned,
      eligible: group.eligible, pool_eligible: group.pool_eligible, exclusions: group.exclusions })),
    ranking: slate.ranking });
  stage = 'snapshot_pagination';
  let currentPage = slate, pageCount = 1, maximumPageBytes = bytes;
  const candidateIds = new Set();
  let candidate;
  while (true) {
    const candidates = currentPage.candidates;
    check(candidates.length === currentPage.coverage.returned);
    check(new Set(candidates.map(item => item.player_id)).size === candidates.length);
    for (const item of candidates) {
      check(!candidateIds.has(item.candidate_id)); candidateIds.add(item.candidate_id);
      check(['listed', 'not_listed', 'unknown'].includes(item.injury.match));
      check(item.injury.flagged === (item.injury.match === 'listed' ? true : item.injury.match === 'not_listed' ? false : null));
      check(item.relationships.game_group && item.relationships.player_group && item.relationships.statistical_outcome_group);
      const context = currentPage.team_contexts[item.team_context_ref];
      check(context && context.league_game_id === item.league_game_id && context.team === item.team);
      check(item.rank === candidateIds.size);
      candidate ??= item;
    }
    check(candidateIds.size + currentPage.coverage.remaining === slate.coverage.eligible);
    if (!currentPage.next_cursor) break;
    check(pageCount < 32);
    const nextResult = await client.callTool({ name: 'get_slate_brief', arguments: {
      ...briefArguments, cursor: currentPage.next_cursor } });
    maximumPageBytes = Math.max(maximumPageBytes, Buffer.byteLength(JSON.stringify(nextResult)));
    currentPage = unpack(nextResult); pageCount++;
    check(currentPage.context_included === false && currentPage.games.length === 0 && !('injuries' in currentPage));
    check(currentPage.snapshot.as_of === slate.snapshot.as_of && currentPage.snapshot.live_availability_checked === false);
    check(currentPage.coverage.returned > 0 && maximumPageBytes <= 32768);
  }
  report('snapshot_pagination', { pages: pageCount, unique_candidates: candidateIds.size,
    eligible: slate.coverage.eligible, complete: candidateIds.size === slate.coverage.eligible, max_bytes: maximumPageBytes });
  if (input.cohort_barrier === true) {
    stage = 'cross_owner_paging_barrier';
    const foreignCursor = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('paging_barrier_timeout')), 60000);
      process.once('message', message => {
        clearTimeout(timer);
        if (message?.event === 'foreign_cursor') resolve(message.cursor); else reject(new Error('invalid_paging_signal'));
      });
      process.send({ event: 'paging_cursor', cursor: slate.next_cursor });
    });
    if (foreignCursor) {
      check(typeof foreignCursor === 'string' && foreignCursor.length <= 2048);
      const denied = await client.callTool({ name: 'get_slate_brief', arguments: { ...briefArguments, cursor: foreignCursor } });
      check(denied.isError === true && denied.structuredContent?.error?.status === 400
        && denied.structuredContent?.error?.code === 'invalid_cursor');
      report('cross_owner_cursor_denied', { status: 400 });
    } else report('cross_owner_cursor_no_live_witness', { eligible: slate.coverage.eligible });
  }
  stage = 'evidence_sections';
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
  if (candidate) {
    stage = 'gamecenter_current_offers';
    const priced = unpack(await client.callTool({ name: 'get_gamecenter_packet', arguments: {
      ...candidate.gamecenter, compact: true, include_current_offers: true } }));
    check(priced.current_offers?.schema === 'nhl-gamecenter-current-offers-v1');
    check(priced.current_offers.live_checked === false);
    report('gamecenter_current_offers', { status: priced.current_offers.status,
      coverage: priced.current_offers.coverage, reason: priced.current_offers.reason ?? null });
  }
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
      ...briefArguments, markets: ['skater_shots_on_goal'], candidate_limit: 1 } });
    check(unpack(result).scope.included_games === input.game_count);
    await fresh.close();
  }
  report('refresh_rotation', { generations: 2, fresh_connections: 2 });
  const frozenAccess = tokens.access_token;
  // Retain status classes only, never request/response bodies or grant identifiers.
  page.on('response', response => {
    const url = new URL(response.url());
    if (url.origin !== ISSUER) return;
    const kind = url.pathname === '/api/account/oauth/connections' ? 'account_connections'
      : /^\/api\/account\/oauth\/connections\/[^/]+\/revoke$/.test(url.pathname) ? 'account_revoke' : null;
    if (kind) statuses.push({ kind, status: response.status() });
  });
  stage = 'browser_revocation_account_page';
  await page.goto(ISSUER + '/account/api', { waitUntil: 'domcontentloaded' });
  // The loading branch also mounts a connected-apps panel. Wait for its parent
  // transition before clicking: a remount would discard the open confirmation.
  stage = 'browser_revocation_account_ready';
  await page.getByTestId('api-access-page').or(page.getByTestId('api-access-error')).waitFor({ state: 'visible' });
  stage = 'browser_revocation_connection_button';
  await page.getByRole('button', { name: `Revoke connection to ${clientName}`, exact: true }).click();
  stage = 'browser_revocation_confirmation';
  await page.getByRole('button', { name: 'Revoke app', exact: true }).click();
  stage = 'browser_revocation_success_notice';
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
