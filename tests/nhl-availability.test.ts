import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server.js";
import { startMockApi } from "./mock-api.js";

const date = "2026-11-09";
const league_game_id = "2026020001";
const goaliePath = "/api/v1/nhl/goalie-status";
const injuryPath = "/api/v1/nhl/injury-updates";
const goalie = { enabled: true, contract_version: 1, method: "GET", path: goaliePath, schema: "nhl-goalie-status-v1" };
const injury = { enabled: true, contract_version: 1, method: "GET", path: injuryPath, schema: "nhl-injury-updates-v1" };
const identity = { league_game_id, away_team: "AAA", home_team: "BBB", scheduled_start_at: "2026-11-10T01:00:00+00:00" };
const starter = {
  frozen: { player_name: "Frozen Starter", generated_at: "2026-11-09T13:00:00+00:00" },
  latest_pregame: { player_name: "New Starter", status: "confirmed", observed_at: "2026-11-09T23:30:00+00:00" },
  newer_than_frozen: true, changed_from_frozen: true,
};
const firstGoaliePage = {
  schema: goalie.schema, sport: "nhl", date, games: [{ ...identity, away: starter }], next_cursor: "opaque+1",
};
const firstInjuryPage = {
  schema: injury.schema, sport: "nhl", date, scope: "team_report", game: identity,
  reports: { home: { coverage: "partial", observed_at: "2026-11-09T23:15:00+00:00",
    source_updated_at: "2026-11-08T18:00:00+00:00", source_freshness: "stale" } },
  players: [{ side: "home", player_name: "Flagged Player", status: null, game_time_decision: true }],
  next_cursor: "report+revision",
};

async function connect(t: TestContext, discovery: Record<string, unknown>,
  response: (url: URL) => { status?: number; body: unknown }) {
  const api = await startMockApi((request, reply) => {
    const url = new URL(request.url!, "http://localhost");
    if (![goaliePath, injuryPath, "/api/v1/nhl"].includes(url.pathname)) return false;
    const result = url.pathname === "/api/v1/nhl" ? { body: discovery } : response(url);
    reply.writeHead(result.status ?? 200, { "content-type": "application/json" });
    reply.end(JSON.stringify(result.body));
    return true;
  });
  t.after(() => api.close());
  const [ct, st] = InMemoryTransport.createLinkedPair();
  const server = createServer({ apiKey: "hg_test_availability", baseUrl: new URL(api.baseUrl), discoveryTtlMs: 300000,
    timeoutMs: 2000, maxResponseBytes: 1024 * 1024 });
  const client = new Client({ name: "availability-test", version: "1" });
  t.after(async () => { await client.close(); await server.close(); });
  await Promise.all([server.connect(st), client.connect(ct)]);
  return { api, client, read: (name: string, args: Record<string, unknown>) => client.callTool({
    name, arguments: { date, ...args },
  }) };
}

test("both tools preserve the stored data and make one protected request per page", async (t) => {
  const { api, client, read } = await connect(t, { goalie_status: goalie, injury_updates: injury }, url => {
    const page = url.pathname === goaliePath ? firstGoaliePage : firstInjuryPage;
    return { body: url.searchParams.has("cursor") || (url.pathname === goaliePath && url.searchParams.has("league_game_id"))
      ? { ...page, next_cursor: null } : page };
  });
  for (const name of ["get_goalie_status", "get_injury_updates"]) {
    const tool = (await client.listTools()).tools.find(item => item.name === name);
    assert.deepEqual(tool?.annotations, { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true });
  }
  for (const [name, args, expected] of [
    ["get_goalie_status", { page_size: 1 }, firstGoaliePage],
    ["get_goalie_status", { page_size: 1, cursor: "opaque+1" }, { ...firstGoaliePage, next_cursor: null }],
    ["get_goalie_status", { league_game_id }, { ...firstGoaliePage, next_cursor: null }],
    ["get_injury_updates", { league_game_id, side: "home", page_size: 1 }, firstInjuryPage],
    ["get_injury_updates", { league_game_id, side: "home", page_size: 1, cursor: "report+revision" },
      { ...firstInjuryPage, next_cursor: null }],
  ] as const) {
    const result = await read(name, args);
    assert.equal(result.isError, undefined);
    assert.equal(result.structuredContent, undefined);
    assert.deepEqual(result.content, [{ type: "text", text: JSON.stringify(expected) }]);
  }
  assert.deepEqual(api.requests.map(req => [req.method, req.path, req.authorization]), [
    ["GET", "/api/v1/nhl", undefined],
    ["GET", `${goaliePath}?date=${date}&page_size=1`, "Bearer hg_test_availability"],
    ["GET", `${goaliePath}?date=${date}&page_size=1&cursor=opaque%2B1`, "Bearer hg_test_availability"],
    ["GET", `${goaliePath}?date=${date}&league_game_id=${league_game_id}`, "Bearer hg_test_availability"],
    ["GET", `${injuryPath}?date=${date}&league_game_id=${league_game_id}&side=home&page_size=1`, "Bearer hg_test_availability"],
    ["GET", `${injuryPath}?date=${date}&league_game_id=${league_game_id}&side=home&page_size=1&cursor=report%2Brevision`,
      "Bearer hg_test_availability"],
  ]);
});

test("absent, disabled, incompatible or forged discovery does not authorize a protected read", async (t) => {
  for (const bad of [undefined, { enabled: false }, { contract_version: 2 }, { method: "POST" },
    { path: "https://untrusted.invalid/goalie-status" }, { schema: injury.schema }]) {
    const descriptor = bad && { ...goalie, ...bad };
    const { api, read } = await connect(t, { goalie_status: descriptor, injury_updates: injury },
      url => url.pathname === injuryPath ? { body: firstInjuryPage } : assert.fail("Goalie request issued"));
    const rejected = await read("get_goalie_status", {});
    assert.equal(rejected.isError, true);
    assert.match(JSON.stringify(rejected), /goalie_status_unavailable.*GET \/api\/v1\/nhl/);
    assert.equal((await read("get_injury_updates", { league_game_id })).isError, undefined);
    assert.deepEqual(api.requests.map(req => new URL(req.path, "http://localhost").pathname), ["/api/v1/nhl", injuryPath]);
  }
  const { api, read } = await connect(t, { goalie_status: goalie, injury_updates: { ...injury, path: goaliePath } },
    url => url.pathname === goaliePath ? { body: firstGoaliePage } : assert.fail("Injury request issued"));
  const rejected = await read("get_injury_updates", { league_game_id });
  assert.match(JSON.stringify(rejected), /injury_updates_unavailable.*GET \/api\/v1\/nhl/);
  assert.equal((await read("get_goalie_status", {})).isError, undefined);
  assert.equal(api.requests.length, 2);
});

test("invalid selectors are local and expired injury cursors surface one actionable error", async (t) => {
  const { api, read } = await connect(t, { goalie_status: goalie, injury_updates: injury }, () => ({
    status: 400, body: { code: "invalid_cursor", detail: "Repeat without a cursor to restart paging." },
  }));
  for (const [name, args] of [
    ["get_goalie_status", { date: "2026-02-29" }],
    ["get_goalie_status", { league_game_id, page_size: 1 }],
    ["get_goalie_status", { league_game_id, cursor: "opaque" }],
    ["get_goalie_status", { page_size: 5 }],
    ["get_injury_updates", {}],
    ["get_injury_updates", { league_game_id, side: "both" }],
    ["get_injury_updates", { league_game_id, page_size: 13 }],
  ] as const) assert.equal((await read(name, args)).isError, true);
  assert.equal(api.requests.length, 0);
  const result = await read("get_injury_updates", { league_game_id, cursor: "old" });
  assert.equal(result.isError, true);
  assert.match(JSON.stringify(result), /invalid_cursor.*restart paging/);
  assert.equal(api.requests.length, 2);
});

test("the UTF-8 ceiling preserves whole pages and malformed envelopes fail closed", async (t) => {
  const { read } = await connect(t, { goalie_status: goalie, injury_updates: injury }, url => ({
    body: url.pathname === goaliePath
      ? { ...firstGoaliePage, games: [{ description: "é".repeat(1800) }] }
      : { ...firstInjuryPage, next_cursor: 1 },
  }));
  const oversized = await read("get_goalie_status", {});
  assert.equal(oversized.isError, true);
  assert.match(JSON.stringify(oversized), /goalie_status_too_large.*Reduce page_size/);
  assert.doesNotMatch(JSON.stringify(oversized), /é/);
  const invalid = await read("get_injury_updates", { league_game_id });
  assert.equal(invalid.isError, true);
  assert.match(JSON.stringify(invalid), /injury_updates_invalid_response/);
});
