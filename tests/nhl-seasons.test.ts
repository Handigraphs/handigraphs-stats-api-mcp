import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server.js";
import { startMockApi } from "./mock-api.js";

const resources = ["goalies", "skaters", "teams", "teams_by_position"];
const pathFor = (resource: string) => resource === "teams_by_position" ? "teams/by-position" : resource;

async function fixture(t: test.TestContext, advertised = true) {
  const api = await startMockApi((request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    const send = (body: unknown) => {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify(body));
      return true;
    };
    if (url.pathname === "/api/v1") return send({ sports: [{ id: "nhl", href: "/api/v1/nhl" }] });
    if (url.pathname === "/api/v1/nhl") return send({ sport: "nhl", resources: resources.map((id) => ({
      id, href: `/api/v1/nhl/${pathFor(id)}`, metrics: `/api/v1/nhl/metrics?resource=${id}`,
      splits: `/api/v1/nhl/splits?resource=${id}`, filters: ["split", "metrics", "cursor", ...(advertised ? ["season"] : [])],
    })) });
    if (url.pathname === "/api/v1/nhl/metrics") return send({ metrics: { games_played: { scale: "integer" } } });
    if (url.pathname === "/api/v1/nhl/splits") return send({ splits: [{ id: "season" }] });
    if (resources.some((id) => url.pathname === `/api/v1/nhl/${pathFor(id)}`)) {
      const season = url.searchParams.get("season") ?? "20252026";
      return send({ data: [], meta: { season: Number(season.slice(4)), context: { season }, data_as_of: null,
        pagination: { next_cursor: null } } });
    }
    return false;
  });
  t.after(() => api.close());
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createServer({ apiKey: "hg_test_nhl_synthetic", baseUrl: new URL(api.baseUrl),
    discoveryTtlMs: 300_000, timeoutMs: 2_000, maxResponseBytes: 5 * 1024 * 1024 });
  const client = new Client({ name: "nhl-season-test", version: "1.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  t.after(async () => { await client.close(); await server.close(); });
  return { api, client };
}

test("query_stats exposes season and forwards explicit and omitted selections for all NHL resources", async (t) => {
  const { api, client } = await fixture(t);
  const tool = (await client.listTools()).tools.find((item) => item.name === "query_stats");
  assert.ok(tool?.inputSchema.properties?.season);
  for (const resource of resources) {
    for (const season of [undefined, "20252026", "20262027"]) {
      const result = await client.callTool({ name: "query_stats", arguments: {
        sport: "nhl", resource, split: "season", metrics: ["games_played"], cursor: "same-season-cursor",
        ...(season ? { season } : {}),
      } });
      assert.equal(result.isError, undefined);
      const query = new URL(api.requests.at(-1)?.path ?? "", "http://localhost");
      assert.equal(query.pathname, `/api/v1/nhl/${pathFor(resource)}`);
      assert.equal(query.searchParams.get("season"), season ?? null);
      assert.equal(query.searchParams.get("cursor"), "same-season-cursor");
      assert.equal(query.searchParams.get("stat_format"), "compact");
      assert.equal(query.searchParams.get("meta"), "compact");
      const body = (result.structuredContent as { response: { data: unknown[]; meta: { season: number; data_as_of: null } } }).response;
      assert.deepEqual(body.data, []);
      assert.equal(body.meta.data_as_of, null);
      assert.equal(body.meta.season, Number((season ?? "20252026").slice(4)));
    }
  }
});

test("older NHL discovery rejects explicit season without querying protected data", async (t) => {
  const { api, client } = await fixture(t, false);
  const result = await client.callTool({ name: "query_stats", arguments: { sport: "nhl", resource: "skaters", season: "20262027" } });
  assert.equal(result.isError, true);
  assert.equal(api.requests.some((item) => item.authorization !== undefined), false);
  assert.match(JSON.stringify(result), /not supported by this resource/);
});

test("malformed NHL seasons never issue a protected request", async (t) => {
  const { api, client } = await fixture(t);
  for (const season of ["", " ", "2026", "2027", "20262028", "20262027;", "2026-2027", "٢٠٢٦٢٠٢٧"]) {
    const result = await client.callTool({ name: "query_stats", arguments: { sport: "nhl", resource: "skaters", season } });
    assert.equal(result.isError, true, season);
  }
  assert.equal(api.requests.some((item) => item.authorization !== undefined), false);
});
