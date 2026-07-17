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

test("problem+json maps to a redacted retryable MCP error without automatic retry", async (t) => {
  let protectedCalls = 0;
  const api = await startMockApi((request, response) => {
    if (request.url?.startsWith("/api/v1/mlb/batters?")) {
      protectedCalls += 1;
      response.writeHead(429, { "content-type": "application/problem+json", "retry-after": "7", "x-request-id": "req-limit" });
      response.end(JSON.stringify({ code: "rate_limit_exceeded", detail: "Do not expose hg_test_never_log", field_errors: { authorization: "Bearer hg_test_never_log" }, request_id: "req-limit" }));
      return true;
    }
    return false;
  }); t.after(() => api.close());
  const connection = await connectedClient(api.baseUrl); t.after(() => connection.close());
  const result = await connection.client.callTool({ name: "query_stats", arguments: { sport: "mlb", resource: "batters" } });
  assert.equal(result.isError, true); assert.equal(protectedCalls, 1);
  const text = (result as { content: Array<{ text: string }> }).content[0]?.text ?? "";
  assert.equal(text.includes("hg_test_never_log"), false);
  assert.match(text, /rate_limit_exceeded/); assert.match(text, /retry_after_seconds/);
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
