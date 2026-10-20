import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer as httpServer, request as httpRequest, type IncomingMessage, type ServerResponse } from "node:http";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createHostedGateway } from "../src/hosted-index.js";
import { loadHostedConfig, requestConfig } from "../src/hosted-config.js";
import { serviceAuthorization } from "../src/hosted-auth.js";
import { createServer } from "../src/server.js";
import { agentDescriptor, startMockApi, type MockApi } from "./mock-api.js";

const SUBJECT_A = "a".repeat(43), SUBJECT_B = "b".repeat(43);
const SERVICE_SECRET = "synthetic-independent-hosted-test-service-secret";
const ACCEPT = "application/json, text/event-stream";
const INIT = { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "test", version: "1" } } };

async function mockIssuer(custom?: (request: IncomingMessage, response: ServerResponse) => boolean) {
  const exchanges: Array<{ subject: string; delegated: string }> = [];
  const state = { revoked: false, unavailable: false };
  const api = await startMockApi((request, response) => {
    if (custom?.(request, response)) return true;
    const url = new URL(request.url ?? "/", "http://localhost");
    const send = (value: unknown, status = 200) => {
      response.writeHead(status, { "Content-Type": "application/json" }); response.end(JSON.stringify(value));
    };
    if (url.pathname === "/oauth/token") {
      let raw = ""; request.on("data", (chunk) => { raw += String(chunk); });
      request.on("end", () => {
        const fields = new URLSearchParams(raw);
        const subject = fields.get("subject_token") ?? "";
        if (state.unavailable) { send({ error: "temporarily_unavailable" }, 503); return; }
        if (state.revoked || ![SUBJECT_A, SUBJECT_B].includes(subject)) { send({ error: "invalid_grant" }, 400); return; }
        const owner = subject === SUBJECT_A ? "A" : "B";
        const delegated = "e30." + Buffer.from(JSON.stringify({ owner, sequence: exchanges.length })).toString("base64url") + ".synthetic_signature";
        exchanges.push({ subject, delegated });
        send({ access_token: delegated, token_type: "Bearer", issued_token_type: "urn:ietf:params:oauth:token-type:access_token",
          expires_in: 60, scope: owner === "A" ? "stats:read filters:write research:run" : "stats:read" });
      }); return true;
    }
    if (url.pathname === "/api/v1") { send({ api_version: "v1", sports: [{ id: "mlb", href: "/api/v1/mlb" }], agent: agentDescriptor() }); return true; }
    const protectedPaths = ["/api/v1/agent/capabilities", "/api/v1/filters", "/api/v1/mlb/batters", "/api/v1/research/jobs"];
    if (protectedPaths.includes(url.pathname)) {
      const token = request.headers.authorization?.slice(7);
      const issued = exchanges.find((exchange) => exchange.delegated === token);
      if (!issued) { send({ code: "invalid_oauth_token", detail: "Invalid delegated credential" }, 401); return true; }
      const owner = issued.subject === SUBJECT_A ? "A" : "B";
      if (url.pathname === "/api/v1/agent/capabilities") {
        send({ owner, permissions: owner === "A" ? ["filters:write", "research:run"] : [],
          operations: { jobs_submit: { available: false, reason: "oauth_research_unavailable" } },
          worker: { available: false, reason: "oauth_research_unavailable" } }); return true;
      }
      if (url.pathname === "/api/v1/research/jobs") {
        send({ code: "oauth_research_unavailable", detail: "OAuth historical execution is not yet available." }, 503); return true;
      }
      if (url.pathname === "/api/v1/filters" && request.method === "POST") {
        send({ code: "research_storage_unavailable", detail: "Use the same operation ID." }, 503); return true;
      }
      if (url.pathname === "/api/v1/filters") {
        send({ filters: [{ id: owner === "A" ? 1 : 2, name: owner }], next_cursor: null }); return true;
      }
      send({ data: [{ owner, text: `${issued.subject} ${token} ${SERVICE_SECRET}` }], meta: { pagination: { next_cursor: null } } }); return true;
    }
    return false;
  });
  return { api, exchanges, state };
}

async function gateway(api: MockApi, extra: NodeJS.ProcessEnv = {}) {
  // Reserve an ephemeral loopback port before constructing the exact resource.
  const reserve = httpServer(); reserve.listen(0, "127.0.0.1"); await once(reserve, "listening");
  const address = reserve.address(); assert.ok(address && typeof address !== "string");
  const port = address.port; await new Promise<void>((resolve) => reserve.close(() => resolve()));
  const config = loadHostedConfig({ HANDIGRAPHS_HOSTED_ENABLED: "true", HANDIGRAPHS_HOSTED_ALLOW_LOOPBACK: "true",
    HANDIGRAPHS_MCP_RESOURCE_URL: `http://127.0.0.1:${port}/mcp`, HANDIGRAPHS_OAUTH_ISSUER: new URL(api.baseUrl).origin,
    HANDIGRAPHS_MCP_SERVICE_CLIENT_ID: "gateway-test", HANDIGRAPHS_MCP_SERVICE_SECRET: SERVICE_SECRET, ...extra });
  const instance = createHostedGateway(config);
  instance.server.listen(port, "127.0.0.1"); await once(instance.server, "listening");
  return { ...instance, config, url: config.resource };
}

async function connected(url: string, subject = SUBJECT_A, fetchImpl?: typeof fetch) {
  const client = new Client({ name: "hosted-test", version: "1" });
  const transport = new StreamableHTTPClientTransport(new URL(url), { requestInit: { headers: { Authorization: "Bearer " + subject } },
    ...(fetchImpl ? { fetch: fetchImpl } : {}) });
  await client.connect(transport as Transport);
  return { client, transport };
}

function post(url: string, value: unknown = INIT, headers: Record<string, string> = {}) {
  return fetch(url, { method: "POST", headers: { Authorization: "Bearer " + SUBJECT_A,
    "Content-Type": "application/json", Accept: ACCEPT, ...headers }, body: typeof value === "string" ? value : JSON.stringify(value) });
}

test("public metadata is exact while initialize, list, call and unsupported methods require OAuth", async (t) => {
  const issuer = await mockIssuer(); t.after(() => issuer.api.close());
  const host = await gateway(issuer.api); t.after(() => host.shutdown());
  const root = new URL(host.url).origin;
  const metadata = await fetch(root + "/.well-known/oauth-protected-resource/mcp");
  assert.equal((await metadata.json() as { resource: string }).resource, host.url);
  assert.deepEqual(await (await fetch(root + "/health/ready")).json(), { ready: true, stateless: true, version: "0.3.0" });
  for (const method of ["GET", "DELETE", "POST"]) {
    const result = await fetch(host.url, { method });
    assert.equal(result.status, 401); assert.equal(result.headers.get("cache-control"), "no-store");
    assert.match(result.headers.get("www-authenticate") ?? "", new RegExp(root.replaceAll(".", "\\.") + "/.well-known/oauth-protected-resource/mcp"));
  }
  for (const method of ["GET", "DELETE"]) {
    const result = await fetch(host.url, { method, headers: { Authorization: "Bearer " + SUBJECT_A } });
    assert.equal(result.status, 405); assert.equal(result.headers.get("allow"), "POST");
  }
  for (const method of ["initialize", "tools/list", "tools/call"]) {
    const result = await post(host.url, { ...INIT, method }, { Authorization: "Bearer " + "x".repeat(43) });
    assert.equal(result.status, 401); assert.match(result.headers.get("www-authenticate") ?? "", /invalid_token/);
  }
});

test("official client shares nineteen schemas, exchanges every message and isolates concurrent users", async (t) => {
  const issuer = await mockIssuer(); t.after(() => issuer.api.close());
  const host = await gateway(issuer.api); t.after(() => host.shutdown());
  const a = await connected(host.url), b = await connected(host.url, SUBJECT_B);
  t.after(() => a.client.close()); t.after(() => b.client.close());
  assert.equal(a.transport.sessionId, undefined); assert.equal(b.transport.sessionId, undefined);
  const tools = (await a.client.listTools()).tools;
  assert.equal(tools.length, 19); assert.equal(tools.some((tool) => tool.name === "configure_api_key"), false);
  const local = createServer(requestConfig(host.config, "hg_test_synthetic_local"), { enableLocalSetup: true,
    setupLauncher: async () => ({ status: "launched", message: "Synthetic helper." }) });
  const localClient = new Client({ name: "local-contract-parity", version: "1" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  t.after(() => localClient.close()); t.after(() => local.close());
  await Promise.all([local.connect(serverTransport), localClient.connect(clientTransport)]);
  const localTools = (await localClient.listTools()).tools;
  assert.equal(localTools.length, 20);
  assert.deepEqual(tools, JSON.parse(JSON.stringify(localTools.filter((tool) => tool.name !== "configure_api_key"))));
  const before = issuer.exchanges.length;
  const results = await Promise.all(Array.from({ length: 12 }, async (_, index) => {
    const owner = index % 2 ? "B" : "A";
    const result = await (index % 2 ? b : a).client.callTool({ name: "list_saved_filters", arguments: {} });
    assert.equal(result.isError, undefined);
    assert.match(JSON.stringify(result), new RegExp(`"name":"${owner}"`));
    return result;
  }));
  assert.equal(results.length, 12); assert.equal(issuer.exchanges.length - before, 12);
  const capabilities = await Promise.all([a, b, a].map((connection) => connection.client.callTool({ name: "describe_filter_capabilities", arguments: {} })));
  assert.deepEqual(capabilities.map((result) => (result.structuredContent as { response: { owner: string } }).response.owner), ["A", "B", "A"]);
  const protectedRequests = issuer.api.requests.filter((req) => req.path.startsWith("/api/v1/filters") || req.path.startsWith("/api/v1/agent/capabilities"));
  assert.equal(new Set(protectedRequests.map((req) => req.authorization)).size, protectedRequests.length);
  assert.equal(issuer.api.requests.filter((req) => ["/api/v1", "/api/v1/mlb"].includes(req.path)).every((req) => req.authorization === undefined), true);
  assert.equal(issuer.api.requests.filter((req) => req.path === "/api/v1").length, 1);
  for (const request of issuer.api.requests.filter((req) => req.path === "/oauth/token")) {
    assert.equal(request.authorization, serviceAuthorization(host.config));
    const body = new URLSearchParams(request.body);
    assert.equal(body.get("resource"), issuer.api.baseUrl); assert.equal(body.get("audience"), issuer.api.baseUrl);
  }
  assert.equal(issuer.api.requests.filter((req) => req.path.startsWith("/api/v1/")).some((req) => req.authorization?.includes(SUBJECT_A)), false);
});

test("one official client can split stateless messages across two instances and redact all secret echoes", async (t) => {
  const issuer = await mockIssuer(); t.after(() => issuer.api.close());
  const first = await gateway(issuer.api), second = await gateway(issuer.api);
  t.after(() => first.shutdown()); t.after(() => second.shutdown());
  let calls = 0;
  const routed: typeof fetch = async (input, init) => {
    const target = calls++ % 2 ? second.url : first.url;
    return fetch(target, init);
  };
  const connection = await connected(first.url, SUBJECT_A, routed); t.after(() => connection.client.close());
  for (let index = 0; index < 3; index++) {
    const result = await connection.client.callTool({ name: "query_stats", arguments: { sport: "mlb", resource: "batters" } });
    assert.equal(result.isError, undefined);
    const serialized = JSON.stringify(result);
    for (const secret of [SUBJECT_A, SERVICE_SECRET, ...issuer.exchanges.map((exchange) => exchange.delegated)]) assert.equal(serialized.includes(secret), false);
  }
  assert.ok(calls >= 5); assert.equal(connection.transport.sessionId, undefined);
});

test("PR03 unavailable research and ambiguous mutations are preserved once without retries", async (t) => {
  const issuer = await mockIssuer(); t.after(() => issuer.api.close());
  const host = await gateway(issuer.api); t.after(() => host.shutdown());
  const connection = await connected(host.url); t.after(() => connection.client.close());
  const research = await connection.client.callTool({ name: "start_filter_research", arguments: {
    operation_id: "3600b508-8aa9-4148-be37-cbed6b6a1254", rule: { table: "nhl_skaters", split: "season", criteria: [] },
    season: 20252026, game_type: 2, start_date: "2025-10-01", end_date: "2026-04-15", market: "sog", side: "over", line: 2.5, min_sample: 25,
  } });
  assert.equal(research.isError, true); assert.match(JSON.stringify(research), /oauth_research_unavailable/);
  const save = await connection.client.callTool({ name: "save_filter", arguments: {
    operation_id: "3600b508-8aa9-4148-be37-cbed6b6a1253", name: "Explicit synthetic save", rule: { table: "nhl_skaters", split: "season", criteria: [] },
  } });
  assert.equal(save.isError, true); assert.match(JSON.stringify(save), /research_storage_unavailable/);
  assert.equal(issuer.api.requests.filter((req) => req.method === "POST" && req.path === "/api/v1/research/jobs").length, 1);
  assert.equal(issuer.api.requests.filter((req) => req.method === "POST" && req.path === "/api/v1/filters").length, 1);
});

test("Host/Origin, malformed/oversized bodies and absolute slow-body deadlines reject before exchange", async (t) => {
  const issuer = await mockIssuer(); t.after(() => issuer.api.close());
  const host = await gateway(issuer.api, { HANDIGRAPHS_HOSTED_BODY_TIMEOUT_MS: "50" }); t.after(() => host.shutdown());
  assert.equal((await post(host.url, INIT, { Origin: "https://evil.test" })).status, 403);
  const badHost = await new Promise<number>((resolve, reject) => {
    const request = httpRequest(host.url, { method: "POST", headers: { Host: "evil.test",
      "X-Forwarded-Host": new URL(host.url).host, Authorization: "Bearer " + SUBJECT_A,
      "Content-Type": "application/json", Accept: ACCEPT } }, (response) => { response.resume(); response.once("end", () => resolve(response.statusCode!)); });
    request.on("error", reject); request.end(JSON.stringify(INIT));
  });
  assert.equal(badHost, 403);
  assert.equal((await post(host.url, "invalid-json")).status, 400);
  assert.equal((await post(host.url, "x".repeat(131073))).status, 413);
  const slow = await new Promise<number>((resolve, reject) => {
    const request = httpRequest(host.url, { method: "POST", headers: { Authorization: "Bearer " + SUBJECT_A,
      "Content-Type": "application/json", Accept: ACCEPT } }, (response) => { response.resume(); response.once("end", () => resolve(response.statusCode!)); });
    request.on("error", reject); request.write('{"jsonrpc":"2.0",');
    const timer = setInterval(() => request.write(" "), 10);
    request.once("close", () => clearInterval(timer));
    t.after(() => { clearInterval(timer); request.destroy(); });
  });
  assert.equal(slow, 408); assert.equal(issuer.exchanges.length, 0);
});

test("exchange outages and revocation give safe503 versus OAuth challenges", async (t) => {
  const issuer = await mockIssuer(); t.after(() => issuer.api.close());
  const host = await gateway(issuer.api); t.after(() => host.shutdown());
  issuer.state.unavailable = true;
  assert.equal((await post(host.url)).status, 503);
  issuer.state.unavailable = false; issuer.state.revoked = true;
  const rejected = await post(host.url);
  assert.equal(rejected.status, 401); assert.match(rejected.headers.get("www-authenticate") ?? "", /invalid_token/);
  assert.equal((await rejected.text()).includes(SUBJECT_A), false);
});

test("delegated rejection and insufficient scope remain HTTP challenges after SDK tool dispatch", async (t) => {
  let status = 401;
  const issuer = await mockIssuer((request, response) => {
    if (request.url?.startsWith("/api/v1/mlb/batters")) {
      response.writeHead(status, { "Content-Type": "application/problem+json",
        ...(status === 403 ? { "WWW-Authenticate": 'Bearer error="insufficient_scope", scope="filters:write"' } : {}) });
      response.end(JSON.stringify({ code: status === 401 ? "invalid_oauth_token" : "stats_api_permission_required", detail: "Denied" })); return true;
    } return false;
  }); t.after(() => issuer.api.close());
  const host = await gateway(issuer.api); t.after(() => host.shutdown());
  for (const value of [401, 403]) {
    status = value;
    const result = await post(host.url, { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "query_stats", arguments: { sport: "mlb", resource: "batters" } } });
    assert.equal(result.status, value); assert.match(result.headers.get("www-authenticate") ?? "", value === 401 ? /invalid_token/ : /insufficient_scope/);
    const connection = await connected(host.url); t.after(() => connection.client.close());
    await assert.rejects(connection.client.callTool({ name: "query_stats", arguments: { sport: "mlb", resource: "batters" } }), { code: value });
  }
});

test("real streamed exchange has a whole-exchange deadline despite receiving bytes", async (t) => {
  const issuer = await mockIssuer((request, response) => {
    if (request.url === "/oauth/token") {
      request.resume(); response.writeHead(200, { "Content-Type": "application/json" }); response.write('{"access_token":"');
      const timer = setInterval(() => response.write("x"), 10);
      response.once("close", () => clearInterval(timer)); return true;
    } return false;
  }); t.after(() => issuer.api.close());
  const host = await gateway(issuer.api, { HANDIGRAPHS_HOSTED_EXCHANGE_TIMEOUT_MS: "50" }); t.after(() => host.shutdown());
  const response = await post(host.url);
  assert.equal(response.status, 503); assert.deepEqual(await response.json(), { error: "temporarily_unavailable" });
});

test("whole protocol deadline aborts slow private I/O and shutdown cancels shared discovery", async (t) => {
  for (const path of ["/api/v1/filters", "/api/v1"]) await t.test(path, async (t) => {
    const issuer = await mockIssuer((request, response) => {
      if (request.url === path) {
        response.writeHead(200, { "Content-Type": "application/json" }); response.write("{");
        const timer = setInterval(() => response.write(" "), 10);
        response.once("close", () => clearInterval(timer)); return true;
      } return false;
    }); t.after(() => issuer.api.close());
    const host = await gateway(issuer.api, { HANDIGRAPHS_HOSTED_REQUEST_TIMEOUT_MS: "80" }); t.after(() => host.shutdown());
    const response = await post(host.url, { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "list_saved_filters", arguments: {} } });
    assert.equal(response.status, 503);
    await response.text(); await host.shutdown();
    assert.equal(host.server.listening, false);
  });
});

test("concurrency admission is bounded and shutdown drains an already running short request", async (t) => {
  let enter!: () => void, release!: () => void;
  const entered = new Promise<void>((resolve) => { enter = resolve; });
  const released = new Promise<void>((resolve) => { release = resolve; });
  const issuer = await mockIssuer((request, response) => {
    if (request.url === "/api/v1/filters") {
      enter(); void released.then(() => { response.writeHead(200, { "Content-Type": "application/json" }); response.end('{"filters":[]}'); }); return true;
    } return false;
  }); t.after(() => issuer.api.close()); t.after(() => release());
  const host = await gateway(issuer.api, { HANDIGRAPHS_HOSTED_MAX_CONCURRENCY: "1" }); t.after(() => host.shutdown());
  // Deliberately use one raw stateless request here: the official client may
  // concurrently probe unsupported GET while initializing (covered above).
  const running = post(host.url, { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "list_saved_filters", arguments: {} } });
  await entered;
  const rejected = await post(host.url); assert.equal(rejected.status, 503); assert.equal(rejected.headers.get("retry-after"), "1");
  const stopping = host.shutdown(); release();
  const result = await running;
  assert.equal(result.status, 200); assert.equal((await result.json() as { result: { isError?: boolean } }).result.isError, undefined);
  await stopping;
  assert.equal(host.server.listening, false);
});
