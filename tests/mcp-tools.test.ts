import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { Config } from "../src/config.js";
import { createServer } from "../src/server.js";
import { startMockApi } from "./mock-api.js";

function config(baseUrl: string): Config { return { apiKey: "hg_test_never_log", baseUrl: new URL(baseUrl), discoveryTtlMs: 300_000, timeoutMs: 2_000, maxResponseBytes: 5 * 1024 * 1024 }; }

async function connectedClient(baseUrl: string) {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createServer(config(baseUrl));
  const client = new Client({ name: "test-client", version: "1.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { client, close: async () => { await client.close(); await server.close(); } };
}

test("all three tools are exposed and query defaults compact, forwards pagination, and never caches data", async (t) => {
  const api = await startMockApi(); t.after(() => api.close());
  const connection = await connectedClient(api.baseUrl); t.after(() => connection.close());
  assert.equal(connection.client.getServerVersion()?.version, "0.2.6");
  assert.deepEqual((await connection.client.listTools()).tools.map((tool) => tool.name), ["list_resources", "describe_resource", "query_stats"]);
  const args = { sport: "mlb", resource: "batters", metrics: ["avg"], filters: [{ metric: "avg", operator: "gte", value: 0.2 }], cursor: "opaque" };
  const first = await connection.client.callTool({ name: "query_stats", arguments: args });
  const second = await connection.client.callTool({ name: "query_stats", arguments: args });
  assert.equal(first.isError, undefined);
  assert.equal((first.structuredContent as { metadata: { request_id: string } }).metadata.request_id, "req-123");
  assert.equal((first.structuredContent as { metadata: { quota_day_remaining: string } }).metadata.quota_day_remaining, "4999");
  const dataRequests = api.requests.filter((item) => item.path.startsWith("/api/v1/mlb/batters?"));
  assert.equal(dataRequests.length, 2);
  assert.match(dataRequests[0]?.path ?? "", /stat_format=compact/);
  assert.match(dataRequests[0]?.path ?? "", /meta=compact/);
  assert.match(dataRequests[0]?.path ?? "", /cursor=opaque/);
  assert.equal(dataRequests.every((item) => item.authorization === "Bearer hg_test_never_log"), true);
  assert.equal(api.requests.filter((item) => !item.path.startsWith("/api/v1/mlb/batters?")).every((item) => item.authorization === undefined), true);
  assert.equal(second.isError, undefined);
});

test("configured Codex mode keeps query tools and adds secure key rotation", async (t) => {
  const api = await startMockApi(); t.after(() => api.close());
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  let launches = 0;
  const server = createServer(config(api.baseUrl), {
    enableLocalSetup: true,
    setupLauncher: async () => {
      launches += 1;
      return { status: "launched", message: "Secure setup window opened." };
    },
  });
  const client = new Client({ name: "rotation-test", version: "1.0.0" });
  t.after(async () => { await client.close(); await server.close(); });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  assert.deepEqual(
    (await client.listTools()).tools.map((tool) => tool.name),
    ["list_resources", "describe_resource", "query_stats", "configure_api_key"],
  );
  const result = await client.callTool({ name: "configure_api_key", arguments: {} });
  assert.equal(result.isError, undefined);
  assert.equal(launches, 1);
});

test("live validation rejects proportion misuse with guidance and limits filters", async (t) => {
  const api = await startMockApi(); t.after(() => api.close());
  const connection = await connectedClient(api.baseUrl); t.after(() => connection.close());
  const misuse = await connection.client.callTool({ name: "query_stats", arguments: { sport: "mlb", resource: "batters", filters: [{ metric: "avg", operator: "gte", value: 20 }] } });
  assert.equal(misuse.isError, true);
  assert.match(((misuse as { content: Array<{ text: string }> }).content[0]?.text ?? ""), /Use 0.20 for 20%/);
  const tooMany = await connection.client.callTool({ name: "query_stats", arguments: { sport: "mlb", resource: "batters", filters: Array.from({ length: 6 }, () => ({ metric: "avg", operator: "gte", value: 0.2 })) } });
  assert.equal(tooMany.isError, true);
  const nonfinite = await connection.client.callTool({ name: "query_stats", arguments: { sport: "mlb", resource: "batters", filters: [{ metric: "avg", operator: "gte", value: Number.POSITIVE_INFINITY }] } });
  assert.equal(nonfinite.isError, true);
  const discoveredOption = await connection.client.callTool({ name: "query_stats", arguments: { sport: "mlb", resource: "teams_by_position", category: "BLOCKS" } });
  assert.equal(discoveredOption.isError, true);
  assert.match(((discoveredOption as { content: Array<{ text: string }> }).content[0]?.text ?? ""), /live split discovery/);
  for (const argumentsValue of [
    { sport: "mlb", resource: "batters", metrics: ["toString"] },
    { sport: "mlb", resource: "batters", filters: [{ metric: "constructor", operator: "gte", value: 1 }] },
    { sport: "mlb", resource: "batters", sort: "valueOf" },
  ]) {
    const inheritedName = await connection.client.callTool({ name: "query_stats", arguments: argumentsValue });
    assert.equal(inheritedName.isError, true);
  }
});

test("empty and duplicate metric projections are rejected before discovery", async (t) => {
  const api = await startMockApi(); t.after(() => api.close());
  const connection = await connectedClient(api.baseUrl); t.after(() => connection.close());
  const empty = await connection.client.callTool({ name: "query_stats", arguments: { sport: "mlb", resource: "batters", metrics: [] } });
  const duplicates = await connection.client.callTool({ name: "query_stats", arguments: { sport: "mlb", resource: "batters", metrics: ["avg", "avg"] } });
  assert.equal(empty.isError, true);
  assert.equal(duplicates.isError, true);
  assert.equal(api.requests.length, 0);
});

test("a cached validation miss forces one live discovery refresh", async (t) => {
  let metricCalls = 0;
  const api = await startMockApi((request, response) => {
    if (request.url?.startsWith("/api/v1/mlb/metrics?")) {
      metricCalls += 1;
      response.writeHead(200, { "content-type": "application/json", etag: `"metrics-v${metricCalls}"` });
      response.end(JSON.stringify({ metrics: metricCalls === 1 ? { avg: { scale: "0_to_1" } } : { avg: { scale: "0_to_1" }, ops: { scale: "numeric" } } }));
      return true;
    }
    return false;
  }); t.after(() => api.close());
  const connection = await connectedClient(api.baseUrl); t.after(() => connection.close());
  await connection.client.callTool({ name: "describe_resource", arguments: { sport: "mlb", resource: "batters" } });
  const result = await connection.client.callTool({ name: "query_stats", arguments: { sport: "mlb", resource: "batters", metrics: ["ops"] } });
  assert.equal(result.isError, undefined);
  assert.equal(metricCalls, 2);
});

test("structured 400, 401, 429, and 503 problems pass through once without retries", async (t) => {
  const cases = [
    { status: 400, code: "invalid_query", retryAfter: undefined },
    { status: 401, code: "invalid_api_key", retryAfter: undefined },
    { status: 429, code: "rate_limit_exceeded", retryAfter: "7" },
    { status: 503, code: "stats_api_capacity_exceeded", retryAfter: "11" },
  ] as const;

  for (const item of cases) {
    await t.test(String(item.status), async (t) => {
      let protectedCalls = 0;
      const api = await startMockApi((request, response) => {
        if (request.url?.startsWith("/api/v1/mlb/batters?")) {
          protectedCalls += 1;
          response.writeHead(item.status, {
            "content-type": "application/problem+json",
            "x-request-id": `req-${item.status}`,
            ...(item.retryAfter ? { "retry-after": item.retryAfter } : {}),
          });
          response.end(JSON.stringify({
            code: item.code,
            detail: `Do not expose hg_test_never_log for ${item.status}`,
            field_errors: { authorization: "Bearer hg_test_never_log" },
            request_id: `req-${item.status}`,
          }));
          return true;
        }
        return false;
      });
      t.after(() => api.close());
      const connection = await connectedClient(api.baseUrl);
      t.after(() => connection.close());

      const result = await connection.client.callTool({ name: "query_stats", arguments: { sport: "mlb", resource: "batters" } });
      assert.equal(result.isError, true);
      assert.equal(protectedCalls, 1);
      const encoded = JSON.stringify(result);
      assert.equal(encoded.includes("hg_test_never_log"), false);
      const problem = (result.structuredContent as { error: Record<string, unknown> }).error;
      assert.equal(problem.status, item.status);
      assert.equal(problem.code, item.code);
      assert.equal(problem.request_id, `req-${item.status}`);
      if (item.retryAfter) assert.equal(problem.retry_after_seconds, Number(item.retryAfter));
      else assert.equal(problem.retry_after_seconds, undefined);
    });
  }
});

test("unknown upstream bodies are hidden", async (t) => {
  const api = await startMockApi((request, response) => {
    if (request.url?.startsWith("/api/v1/mlb/batters?")) {
      response.writeHead(500, { "content-type": "text/html" });
      response.end("private stack trace hg_test_never_log");
      return true;
    }
    return false;
  }); t.after(() => api.close());
  const connection = await connectedClient(api.baseUrl); t.after(() => connection.close());
  const result = await connection.client.callTool({ name: "query_stats", arguments: { sport: "mlb", resource: "batters" } });
  const text = (result as { content: Array<{ text: string }> }).content[0]?.text ?? "";
  assert.equal(result.isError, true);
  assert.equal(text.includes("private stack trace"), false);
  assert.equal(text.includes("hg_test_never_log"), false);
  assert.match(text, /HTTP 500/);
});
