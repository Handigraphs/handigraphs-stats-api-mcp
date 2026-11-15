import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server.js";
import { startMockApi } from "./mock-api.js";
import { invocablePropEvidenceSections } from "../src/prop-evidence.js";

const path = "/api/v1/nhl/slate-brief";
const day = "2026-11-14";
const descriptor = { enabled: true, contract_version: 1, method: "GET", path,
  markets: ["skater_shots_on_goal", "goalie_saves"] };
const payload = { schema: "nhl-slate-brief-v1", sport: "nhl", slate_date: day, season: "20262027", game_type: 2,
  games: [{ league_game_id: "42", read_context: "pregame" }], groups: [],
  coverage: { returned: 0, limited: false }, interpretation: "Statistical candidates, not betting value." };

test("diagnostics use execution's compatibility gate, legacy fallback and advertised section names", () => {
  const compatible = { enabled: true, contract_version: 1, method: "POST", path: "/api/v1/nhl/prop-evidence" };
  assert.deepEqual(invocablePropEvidenceSections(compatible), ["hit_rates", "game_logs", "odds"]);
  assert.deepEqual(invocablePropEvidenceSections({ ...compatible, contract_version: 2, sections: ["hit_rates"] }), []);
  assert.deepEqual(invocablePropEvidenceSections({ ...compatible, sections: ["hit_rates", "new_section"] }), ["hit_rates", "new_section"]);
});

async function connect(t: TestContext, advertised: unknown = descriptor, body: unknown = payload, status = 200) {
  const api = await startMockApi((request, response) => {
    const url = new URL(request.url!, "http://localhost");
    if (![path, "/api/v1/nhl"].includes(url.pathname)) return false;
    response.writeHead(url.pathname === path ? status : 200, { "content-type": "application/json", "retry-after": "15" });
    response.end(JSON.stringify(url.pathname === path ? (typeof body === 'function' ? body(url) : body) : { slate_brief: advertised }));
    return true;
  });
  t.after(() => api.close());
  const server = createServer({ apiKey: "hg_test_synthetic", baseUrl: new URL(api.baseUrl), timeoutMs: 1000,
    discoveryTtlMs: 300000, maxResponseBytes: 1024 * 1024 });
  const client = new Client({ name: "fresh-slate-client", version: "1" });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  t.after(async () => { await client.close(); await server.close(); });
  await Promise.all([server.connect(st), client.connect(ct)]);
  return { api, client, read: (extra: Record<string, unknown> = {}) => client.callTool({
    name: "get_slate_brief", arguments: { sport: "nhl", date: day, ...extra },
  }) };
}

test("a fresh official client reads a slate with one protected GET and no state changes", async t => {
  const { api, client, read } = await connect(t);
  const tool = (await client.listTools()).tools.find(item => item.name === "get_slate_brief")!;
  assert.equal(tool.annotations?.readOnlyHint, true);
  assert.equal(tool.annotations?.destructiveHint, false);
  const result = await read({ markets: ["skater_shots_on_goal"], candidate_limit: 5 });
  assert.equal(result.isError, undefined);
  assert.deepEqual(result.content, [{ type: "text", text: JSON.stringify(payload) }]);
  assert.equal(result.structuredContent, undefined);
  assert.ok(Buffer.byteLength(JSON.stringify(result), "utf8") <= 32768);
  assert.deepEqual(api.requests.map(item => [item.method, item.path, Boolean(item.authorization)]), [
    ["GET", "/api/v1/nhl", false],
    ["GET", path + "?date=" + day + "&markets=skater_shots_on_goal&candidate_limit=5", true],
  ]);
});

test("old, disabled or forged discovery cannot redirect a slate read", async t => {
  for (const advertised of [undefined, { ...descriptor, enabled: false }, { ...descriptor, method: "POST" },
    { ...descriptor, path: "/api/account/write" }, { ...descriptor, contract_version: 2 }]) {
    const { api, read } = await connect(t, advertised ?? null);
    assert.equal((await read()).isError, true);
    assert.equal(api.requests.filter(item => item.authorization).length, 0);
  }
});

test("v2 negotiation is explicit and custom bounds require advertised support", async t => {
  const { api, read } = await connect(t, { ...descriptor, formats: ["legacy", "compact_v2"], price_controls: true },
    { ...payload, schema: "nhl-slate-brief-v2" });
  assert.equal((await read({ price_min: -400, price_max: 500 })).isError, undefined);
  const query = new URL(api.requests.at(-1)!.path, api.baseUrl).searchParams;
  assert.equal(query.get("format"), "compact_v2");
  assert.equal(query.get("price_min"), "-400");
  assert.equal(query.get("price_max"), "500");
  const older = await connect(t);
  assert.equal((await older.read({ price_min: -400 })).isError, true);
  assert.equal(older.api.requests.filter(item => item.authorization).length, 0);
});

test("invalid market, wrong response date, oversized payload and 503 fail without retries", async t => {
  const invalid = await connect(t);
  assert.equal((await invalid.read({ markets: ["bad"] })).isError, true);
  assert.equal(invalid.api.requests.filter(item => item.authorization).length, 0);
  for (const [body, status] of [[{ ...payload, slate_date: "2026-11-13" }, 200],
    [{ ...payload, extra: '"'.repeat(20000) }, 200], [{ code: "stats_api_capacity_exceeded", detail: "Wait" }, 503]] as const) {
    const { api, read } = await connect(t, descriptor, body, status);
    assert.equal((await read()).isError, true);
    assert.equal(api.requests.filter(item => item.authorization).length, 1);
  }
});

const pagedDescriptor = { ...descriptor, formats: ['legacy', 'compact_v2', 'compact_v3'], price_controls: true,
  pagination: { schema: 'nhl-slate-brief-v3', snapshot_seconds: 180 } };
function page(offset = 0, count = 12, total = 19, context = offset === 0) {
  return { ...payload, schema: 'nhl-slate-brief-v3', games: context ? payload.games : [], context_included: context,
    scope: { pregame_only: true }, snapshot: { as_of: '2026-11-14T17:00:00Z', live_availability_checked: false },
    groups: [{ market: 'skater_shots_on_goal', eligible: total, remaining: total-offset-count,
      candidates: Array.from({ length: count }, (_, i) => ({ player_id: String(offset+i+1), candidate_id: 'candidate-'+(offset+i),
        injury: { match: 'not_listed', flagged: false, source_freshness: 'stale' },
        relationships: { game_group: 'same-game', player_group: String(offset+i+1), statistical_outcome_group: 'outcome-'+(offset+i) } })) }],
    next_cursor: offset+count < total ? 'synthetic-page-two' : null,
    coverage: { eligible: total, returned: count, offset, remaining: total-offset-count, limited: offset+count < total } };
}

test('fresh official client pages all 19 candidates in two protected reads without repeated context', async t => {
  const { api, client, read } = await connect(t, pagedDescriptor,
    (url: URL) => url.searchParams.has('cursor') ? page(12, 7) : page());
  const tool = (await client.listTools()).tools.find(item => item.name === 'get_slate_brief')!;
  const properties = tool.inputSchema.properties!;
  for (const key of ['cursor', 'include_context', 'pregame_only']) assert.ok(properties[key]);
  const first = await read();
  assert.equal(first.isError, undefined);
  assert.deepEqual(first.content, [{ type: 'text', text: JSON.stringify(page()) }]);
  const second = await read({ cursor: 'synthetic-page-two' });
  assert.equal(second.isError, undefined);
  assert.deepEqual(second.content, [{ type: 'text', text: JSON.stringify(page(12, 7)) }]);
  assert.ok(Buffer.byteLength(JSON.stringify(first)) <= 32768);
  assert.ok(Buffer.byteLength(JSON.stringify(second)) <= 32768);
  const protectedCalls = api.requests.filter(item => item.authorization);
  assert.equal(protectedCalls.length, 2);
  assert.ok(protectedCalls.every(item => item.method === 'GET' && item.path.includes('format=compact_v3')));
  assert.ok(!protectedCalls[1]!.path.includes('include_context'));
  const ids = [...page().groups[0]!.candidates, ...page(12, 7).groups[0]!.candidates].map(item => item.candidate_id);
  assert.equal(new Set(ids).size, 19);
});

test('context-light and full-slate controls are forwarded only to advertised v3', async t => {
  const body = { ...page(0, 12, 19, false), scope: { pregame_only: false } };
  const { api, read } = await connect(t, pagedDescriptor, body);
  assert.equal((await read({ include_context: false, pregame_only: false })).isError, undefined);
  const query = new URL(api.requests.at(-1)!.path, api.baseUrl).searchParams;
  assert.equal(query.get('include_context'), 'false');
  assert.equal(query.get('pregame_only'), 'false');
  for (const controls of [{ cursor: 'x' }, { include_context: false }, { pregame_only: false }]) {
    const older = await connect(t);
    assert.equal((await older.read(controls)).isError, true);
    assert.equal(older.api.requests.filter(item => item.authorization).length, 0);
  }
});

test('expired snapshot and malformed pages never trigger retry or a silent first-page restart', async t => {
  const expired = await connect(t, pagedDescriptor, { code: 'slate_brief_cursor_expired', detail: 'Restart explicitly.' }, 409);
  assert.equal((await expired.read({ cursor: 'expired' })).isError, true);
  assert.equal(expired.api.requests.filter(item => item.authorization).length, 1);
  const malformed = [
    { ...page(), next_cursor: null }, { ...page(), context_included: false },
    { ...page(), coverage: { ...page().coverage, remaining: 8 } },
    { ...page(), groups: [{ ...page().groups[0]!, candidates: [page().groups[0]!.candidates[0], page().groups[0]!.candidates[0]] }],
      coverage: { eligible: 19, returned: 2, offset: 0, remaining: 17 } },
  ];
  for (const body of malformed) {
    const { api, read } = await connect(t, pagedDescriptor, body);
    assert.equal((await read()).isError, true);
    assert.equal(api.requests.filter(item => item.authorization).length, 1);
  }
});

test('explicit orientation-only first page can continue at zero; empty context-free loops are rejected', async t => {
  const orientation = { ...page(0, 0), coverage: { ...page(0, 0).coverage, context_only: true } };
  const first = await connect(t, pagedDescriptor, orientation);
  assert.equal((await first.read()).isError, undefined);
  const loop = await connect(t, pagedDescriptor, page(0, 0, 19, false));
  assert.equal((await loop.read({ cursor: 'loop' })).isError, true);
});

const rankedDescriptor = { ...pagedDescriptor, formats: [...pagedDescriptor.formats, 'compact_v4'],
  shortlist: { schema: 'nhl-slate-brief-v4', views: ['research', 'shortlist'] } };
function rankedPage(offset = 0) {
  return { ...page(offset, 10, 20, false), schema: 'nhl-slate-brief-v4', view: 'shortlist',
    groups: [{ market: 'skater_shots_on_goal', eligible: 20, returned: 10, remaining: 10-offset, pool_eligible: 140 }],
    candidates: Array.from({ length: 10 }, (_, i) => ({ player_id: String(20-offset-i),
      candidate_id: 'candidate-'+(20-offset-i), rank: offset+i+1, market: 'skater_shots_on_goal',
      league_game_id: '42', team: 'AAA', team_context_ref: '42:AAA',
      injury: { match: 'unknown', matched_known_entry: false, flagged: null }, alternative_market_keys: ['skater_points'] })),
    team_contexts: { '42:AAA': { league_game_id: '42', team: 'AAA', unresolved_identities: 1,
      unresolved_names: ['Named unresolved player'], reported_players: [{ player_name: 'Named teammate', status: 'out' }] } },
    ranking: { basis: 'season_minus_break_even_pp', candidate_pool_count: 140, unique_player_count: 20,
      one_market_per_player: true },
    coverage: { eligible: 20, eligible_player_markets: 140, returned: 10, offset, remaining: 10-offset } };
}

test('fresh official client gets ten global distinct ranks from140 with one protected read and shared facts', async t => {
  const { api, client, read } = await connect(t, rankedDescriptor, rankedPage());
  const tool = (await client.listTools()).tools.find(item => item.name === 'get_slate_brief')!;
  assert.ok(tool.inputSchema.properties!.view);
  const result = await read({ view: 'shortlist', candidate_limit: 10 });
  assert.equal(result.isError, undefined);
  assert.ok(Buffer.byteLength(JSON.stringify(result)) <= 32768);
  assert.deepEqual(result.content, [{ type: 'text', text: JSON.stringify(rankedPage()) }]);
  const protectedCalls = api.requests.filter(item => item.authorization);
  assert.equal(protectedCalls.length, 1);
  const query = new URL(protectedCalls[0]!.path, api.baseUrl).searchParams;
  assert.equal(query.get('format'), 'compact_v4');
  assert.equal(query.get('view'), 'shortlist');
  assert.equal(query.get('candidate_limit'), '10');
});

test('explicit ranked view refuses older API and malformed ranks, counts or dangling team references', async t => {
  const old = await connect(t, pagedDescriptor, page());
  assert.equal((await old.read({ view: 'shortlist' })).isError, true);
  assert.equal(old.api.requests.filter(item => item.authorization).length, 0);
  const missingRef = rankedPage();
  missingRef.team_contexts = {} as typeof missingRef.team_contexts;
  const badRank = rankedPage();
  badRank.candidates[0]!.rank = 99;
  const badPool = rankedPage();
  badPool.coverage.eligible_player_markets = 139;
  for (const body of [missingRef, badRank, badPool]) {
    const { api, read } = await connect(t, rankedDescriptor, body);
    assert.equal((await read({ view: 'shortlist', candidate_limit: 10 })).isError, true);
    assert.equal(api.requests.filter(item => item.authorization).length, 1);
  }
});

test('ranked continuation retains selectors and global ranks without repeating context', async t => {
  const { api, read } = await connect(t, rankedDescriptor, rankedPage(10));
  assert.equal((await read({ view: 'shortlist', candidate_limit: 10, cursor: 'synthetic-page-two' })).isError, undefined);
  assert.equal(api.requests.filter(item => item.authorization).length, 1);
});


const cappedDescriptor = { ...rankedDescriptor, shortlist: { ...rankedDescriptor.shortlist,
  max_candidates_per_game: { minimum: 1, maximum: 12, default: null, scope: 'whole_shortlist_after_player_dedup' } } };
function cappedPage(offset = 0) {
  const base = rankedPage();
  const candidates = base.candidates.slice(0, 2).map((item, i) => ({ ...item,
    player_id: String(offset+i+1), candidate_id: 'capped-'+(offset+i+1), rank: offset+i+1,
    pool_rank: (offset+i)*2+1, league_game_id: String(42+offset+i), team_context_ref: String(42+offset+i)+':AAA' }));
  return { ...base, candidates,
    team_contexts: Object.fromEntries(candidates.map(item => [item.team_context_ref, {
      league_game_id: item.league_game_id, team: item.team, reported_players: [] }])),
    next_cursor: offset === 0 ? 'cap-page-two' : null,
    groups: [{ market: 'skater_shots_on_goal', eligible: 4, returned: 2, remaining: 2-offset, pool_eligible: 140 }],
    coverage: { eligible: 4, eligible_player_markets: 140, returned: 2, offset, remaining: 2-offset },
    ranking: { ...base.ranking, unique_player_count: 4, max_candidates_per_game: 1,
      unique_players_before_game_cap: 8, game_cap_excluded: 4 } };
}

test('advertised whole-list game cap passes unchanged through a fresh client and continuation', async t => {
  const { api, client, read } = await connect(t, cappedDescriptor, (url: URL) => cappedPage(url.searchParams.has('cursor') ? 2 : 0));
  const tool = (await client.listTools()).tools.find(item => item.name === 'get_slate_brief')!;
  assert.ok(tool.inputSchema.properties!.max_candidates_per_game);
  for (const cursor of [undefined, 'cap-page-two']) {
    const result = await read({ view: 'shortlist', candidate_limit: 2, max_candidates_per_game: 1, cursor });
    assert.equal(result.isError, undefined);
    assert.ok(Buffer.byteLength(JSON.stringify(result)) <= 32768);
  }
  const calls = api.requests.filter(item => item.authorization);
  assert.equal(calls.length, 2);
  for (const request of calls) {
    const query = new URL(request.path, api.baseUrl).searchParams;
    assert.equal(query.get('max_candidates_per_game'), '1');
    assert.equal(query.get('candidate_limit'), '2');
    assert.equal(query.get('view'), 'shortlist');
  }
});

test('unsupported cap and invalid scope or range never issue a protected read', async t => {
  for (const advertised of [descriptor, pagedDescriptor, rankedDescriptor]) {
    const { api, read } = await connect(t, advertised);
    assert.equal((await read({ view: 'shortlist', max_candidates_per_game: 1 })).isError, true);
    assert.equal(api.requests.filter(item => item.authorization).length, 0);
  }
  const { api, read } = await connect(t, cappedDescriptor);
  for (const args of [{}, { view: 'research' }, ...[0, 13, 1.5, true].map(cap => ({ view: 'shortlist', max_candidates_per_game: cap }))]) {
    assert.equal((await read({ max_candidates_per_game: 1, ...args })).isError, true);
  }
  assert.equal(api.requests.filter(item => item.authorization).length, 0);
});

test('cap counts, game density and original pool ranks fail closed without retries', async t => {
  const mutations = [
    (body: ReturnType<typeof cappedPage>) => { body.ranking.game_cap_excluded = 5; },
    (body: ReturnType<typeof cappedPage>) => { body.ranking.max_candidates_per_game = 2; },
    (body: ReturnType<typeof cappedPage>) => { body.candidates[1]!.pool_rank = 1; },
    (body: ReturnType<typeof cappedPage>) => { body.candidates[1]!.pool_rank = 9; },
    (body: ReturnType<typeof cappedPage>) => {
      body.candidates[1]!.league_game_id = body.candidates[0]!.league_game_id;
      body.candidates[1]!.team_context_ref = body.candidates[0]!.team_context_ref;
    },
  ];
  for (const mutate of mutations) {
    const body = cappedPage(); mutate(body);
    const { api, read } = await connect(t, cappedDescriptor, body);
    const result = await read({ view: 'shortlist', candidate_limit: 2, max_candidates_per_game: 1 });
    assert.equal(result.isError, true);
    assert.match(JSON.stringify(result), /slate_brief_invalid_response/);
    assert.equal(api.requests.filter(item => item.authorization).length, 1);
  }
});
