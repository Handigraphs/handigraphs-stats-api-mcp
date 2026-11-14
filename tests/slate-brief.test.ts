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
    response.end(JSON.stringify(url.pathname === path ? body : { slate_brief: advertised }));
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
