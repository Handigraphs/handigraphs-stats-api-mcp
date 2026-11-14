import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server.js";
import { compactResource, nhlRecipes } from "../src/resource-compact.js";
import { startMockApi } from "./mock-api.js";

test("compact metric projection preserves definitions, units and requested identities", () => {
  const definition = { description: "Complete per-game definition", unit: "count_per_game", scale: "numeric",
    aliases: ['stats.sog'], precision: 2,
    benchmark: { cutpoints: [1, 2, 3], observed_at: "2026-01-01" } };
  const source = { metrics: { benchmark: { huge: true }, metrics: { sog: definition, assists: definition } } };
  const compact = compactResource(source, ["sog"]);
  assert.deepEqual(compact.metrics.metrics, { sog: { description: definition.description, unit: definition.unit, scale: definition.scale } });
  assert.doesNotMatch(JSON.stringify(compact.metrics), /cutpoints|huge/);
  assert.deepEqual(source.metrics.metrics.sog, definition);
  assert.throws(() => compactResource(source, ["fake"]));
  const recipe = nhlRecipes("goalies")!;
  assert.equal(recipe.screen.arguments.split, "season");
  assert.equal(recipe.screen.arguments.matchup_market, "saves");
  assert.equal(recipe.evidence.market, "goalie_saves");
  assert.match(recipe.sample_note, /five starts; L60\/L120 are minute windows/);
});

test("fresh official clients get bounded compact text and explicit full benchmark discovery", async t => {
  const api = await startMockApi((request, response) => {
    if (!request.url?.startsWith("/api/v1/mlb/metrics")) return false;
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ metrics: { avg: { unit: "proportion", description: "Batting average", benchmark: { cutpoints: "x".repeat(20000) } } } }));
    return true;
  }); t.after(() => api.close());
  const server = createServer({ apiKey: "synthetic", baseUrl: new URL(api.baseUrl), timeoutMs: 1000,
    discoveryTtlMs: 300000, maxResponseBytes: 1024 * 1024 });
  const client = new Client({ name: "compact-discovery", version: "1" });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  t.after(async () => { await client.close(); await server.close(); });
  await Promise.all([server.connect(st), client.connect(ct)]);
  const args = { sport: "mlb", resource: "batters" };
  const compact = await client.callTool({ name: "describe_resource", arguments: args });
  assert.equal(compact.isError, undefined);
  assert.equal(compact.structuredContent, undefined);
  assert.ok(Buffer.byteLength(JSON.stringify(compact)) < 16384);
  assert.doesNotMatch(JSON.stringify(compact), /cutpoints\\"?:/);
  const full = await client.callTool({ name: "describe_resource", arguments: { ...args, detail: "full" } });
  assert.equal(full.isError, undefined);
  assert.match(JSON.stringify(full), /cutpoints/);
});

test("the goalie recipe screens current starters with one protected query and no invented recent-start split", async t => {
  const api = await startMockApi((request, response) => {
    const url = new URL(request.url!, 'http://localhost');
    let body: unknown;
    const metricKeys = ['saves_per_game', 'games_started', 'save_pct', 'gsax_per_60'];
    if (url.pathname === '/api/v1') body = { sports: [{ id: 'nhl' }] };
    else if (url.pathname === '/api/v1/nhl') body = { resources: [{ id: 'goalies', href: '/api/v1/nhl/goalies',
      metrics: '/api/v1/nhl/metrics?resource=goalies', splits: '/api/v1/nhl/splits?resource=goalies',
      filters: ['split', 'day', 'metrics', 'sort', 'page_size', 'stat_format', 'meta', 'matchup_market', 'matchup_window'] }] };
    else if (url.pathname.endsWith('/metrics')) body = { metrics: Object.fromEntries(metricKeys.map(key => [key, { scale: 'numeric' }])) };
    else if (url.pathname.endsWith('/splits')) body = { default: 'season', splits: [{ id: 'season' }, { id: 'L60' }],
      filters: { matchup_market: ['saves'], matchup_window: ['sea'] } };
    else if (url.pathname.endsWith('/goalies')) body = { data: [{ entity: { id: '42', name: 'Synthetic starter' },
      stats: { saves_per_game: 27, games_started: 10, save_pct: .92, gsax_per_60: .3 },
      context: { opponent: 'BOS', venue: 'Home', matchup: { status: 'available', rank: 4, sample_size: 10 } } }],
      meta: { pagination: { next_cursor: null } } };
    else return false;
    response.writeHead(200, { 'content-type': 'application/json' }); response.end(JSON.stringify(body)); return true;
  }); t.after(() => api.close());
  const server = createServer({ apiKey: 'synthetic', baseUrl: new URL(api.baseUrl), timeoutMs: 1000,
    discoveryTtlMs: 300000, maxResponseBytes: 1024 * 1024 }, { enablePropEvidence: true });
  const client = new Client({ name: 'goalie-screen', version: '1' });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  t.after(async () => { await client.close(); await server.close(); });
  await Promise.all([server.connect(st), client.connect(ct)]);
  const result = await client.callTool({ name: 'query_stats', arguments: nhlRecipes('goalies')!.screen.arguments });
  assert.equal(result.isError, undefined);
  const reads = api.requests.filter(item => item.authorization);
  assert.equal(reads.length, 1);
  assert.match(reads[0]!.path, /split=season/);
  assert.match(reads[0]!.path, /matchup_market=saves/);
  assert.ok(Buffer.byteLength(JSON.stringify(result)) < 32768);
});
