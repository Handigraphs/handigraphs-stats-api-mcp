import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server.js";
import { startMockApi } from "./mock-api.js";

const path = "/api/v1/nhl/game-odds";
const descriptor = { enabled: true, contract_version: 1, method: "GET", path };
const date = "2026-11-06";
const firstGame = {
  league_game_id: "2026020001", fixture_id: "42", fetched_at: "2026-11-06T18:00:00Z",
  markets: { moneyline: { book: null, away: { price_american: 125, line: null }, home: { price_american: -145, line: null } } },
};
const firstPage = { schema: "nhl-game-odds-v1", date, quote_type: "latest_stored_pregame",
  games: [firstGame], next_cursor: "opaque+cursor" };

async function connect(t: TestContext, discovery: Record<string, unknown>, response: (query: URLSearchParams) => unknown) {
  const api = await startMockApi((request, reply) => {
    const url = new URL(request.url!, "http://localhost");
    if (url.pathname !== "/api/v1/nhl" && url.pathname !== path) return false;
    reply.writeHead(200, { "content-type": "application/json" });
    reply.end(JSON.stringify(url.pathname === path ? response(url.searchParams) : discovery));
    return true;
  });
  t.after(() => api.close());
  const [ct, st] = InMemoryTransport.createLinkedPair();
  const server = createServer({ apiKey: "hg_test_never_log", baseUrl: new URL(api.baseUrl), discoveryTtlMs: 300000,
    timeoutMs: 2000, maxResponseBytes: 1024 * 1024 });
  const client = new Client({ name: "odds-test", version: "1" });
  t.after(async () => { await client.close(); await server.close(); });
  await Promise.all([server.connect(st), client.connect(ct)]);
  return { api, client, read: (args: Record<string, unknown>) => client.callTool({
    name: "get_game_odds", arguments: { date, ...args },
  }) };
}

test("game odds use one protected read per page and preserve exact IDs, timestamp and book", async (t) => {
  const single = { ...firstPage, next_cursor: null };
  const { api, client, read } = await connect(t, { game_odds: descriptor },
    query => query.has("league_game_id") || query.has("cursor") ? single : firstPage);
  const tool = (await client.listTools()).tools.find(item => item.name === "get_game_odds");
  assert.equal(tool?.annotations?.readOnlyHint, true);
  for (const [args, expected] of [[{ page_size: 1 }, firstPage],
    [{ page_size: 1, cursor: firstPage.next_cursor }, single], [{ league_game_id: firstGame.league_game_id }, single]] as const) {
    const result = await read(args);
    assert.equal(result.isError, undefined);
    assert.equal(result.structuredContent, undefined);
    assert.deepEqual(result.content, [{ type: "text", text: JSON.stringify(expected) }]);
  }
  assert.deepEqual(api.requests.map(x => [x.method, x.path, x.authorization]), [
    ["GET", "/api/v1/nhl", undefined],
    ["GET", `${path}?date=${date}&page_size=1`, "Bearer hg_test_never_log"],
    ["GET", `${path}?date=${date}&page_size=1&cursor=opaque%2Bcursor`, "Bearer hg_test_never_log"],
    ["GET", `${path}?date=${date}&league_game_id=2026020001`, "Bearer hg_test_never_log"],
  ]);
});

test("old, disabled and forged NHL discovery never receive a protected odds request", async (t) => {
  for (const advertised of [undefined, { ...descriptor, enabled: false }, { ...descriptor, contract_version: 2 },
    { ...descriptor, method: "POST" }, { ...descriptor, path: "https://untrusted.invalid/odds" }]) {
    const { api, read } = await connect(t, { game_odds: advertised }, () => assert.fail("Protected request issued"));
    const result = await read({});
    assert.equal(result.isError, true);
    assert.match(JSON.stringify(result), /game_odds_unavailable.*GET \/api\/v1\/nhl/);
    assert.deepEqual(api.requests.map(item => item.path), ["/api/v1/nhl"]);
  }
});

test("malformed selectors fail locally and the byte ceiling never clips a game", async (t) => {
  const { api, read } = await connect(t, { game_odds: descriptor },
    () => ({ ...firstPage, games: [{ ...firstGame, long: "é".repeat(2000) }] }));
  for (const args of [{ date: "2026-02-29" }, { league_game_id: "../1" }, { page_size: 5 },
    { league_game_id: "1", cursor: "opaque" }]) {
    assert.equal((await read(args)).isError, true);
  }
  assert.equal(api.requests.length, 0);
  const result = await read({});
  assert.equal(result.isError, true);
  assert.match(JSON.stringify(result), /game_odds_too_large.*Reduce page_size or request one league_game_id/);
  assert.equal(JSON.stringify(result).includes("é".repeat(30)), false);
  assert.equal(api.requests.length, 2);
});
