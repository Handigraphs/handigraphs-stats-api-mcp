import assert from "node:assert/strict";
import test from "node:test";
import type { Config } from "../src/config.js";
import { DiscoveryClient } from "../src/discovery.js";
import { UpstreamError } from "../src/errors.js";
import { StatsApiHttpClient, type RequestOptions } from "../src/http.js";
import { startMockApi } from "./mock-api.js";

function config(baseUrl: string, maxResponseBytes = 5 * 1024 * 1024): Config { return { apiKey: "hg_test_never_log", baseUrl: new URL(baseUrl), discoveryTtlMs: 300_000, timeoutMs: 2_000, maxResponseBytes }; }

test("discovery never sends Authorization while protected data does", async (t) => {
  const api = await startMockApi(); t.after(() => api.close());
  const http = new StatsApiHttpClient(config(api.baseUrl));
  await http.get("", { protectedData: false });
  await http.get("mlb/batters", { protectedData: true });
  assert.equal(api.requests[0]?.authorization, undefined);
  assert.equal(api.requests[1]?.authorization, "Bearer hg_test_never_log");
});

test("typed transport serializes JSON and allows only explicit conditional headers", async () => {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  const http = new StatsApiHttpClient(config("http://localhost/api/v1"), async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify({ ok: true }), { status: 201, headers: { "content-type": "application/json", etag: '"8"' } });
  });
  const payload = { rule: { criteria: [{ value: "18:00" }] } };
  const result = await http.request("filters", { method: "POST", protectedData: true, body: payload, idempotencyKey: "8f725545-48d9-4ba4-bb8e-b4ad5bf2ebd0" });
  await http.request("filters/42", { method: "PUT", protectedData: true, body: payload, ifMatch: '"7"' });
  assert.equal(calls.length, 2);
  assert.equal(calls[0]?.init?.body, JSON.stringify(payload));
  assert.equal(calls[0]?.init?.redirect, "manual");
  assert.equal(calls[0]?.init?.method, "POST");
  assert.equal(calls[1]?.init?.method, "PUT");
  const postHeaders = new Headers(calls[0]?.init?.headers);
  assert.equal(postHeaders.get("authorization"), "Bearer hg_test_never_log");
  assert.equal(postHeaders.get("content-type"), "application/json");
  assert.equal(postHeaders.get("idempotency-key"), "8f725545-48d9-4ba4-bb8e-b4ad5bf2ebd0");
  assert.equal(new Headers(calls[1]?.init?.headers).get("if-match"), '"7"');
  assert.ok(!("notModified" in result)); assert.equal(result.etag, '"8"');
});

test("typed requests reject malformed bodies, unsafe URLs, invalid headers and methods before fetch", async () => {
  let calls = 0;
  const http = new StatsApiHttpClient(config("http://localhost/api/v1"), async () => { calls++; return new Response(); });
  const cyclic: Record<string, unknown> = {}; cyclic.self = cyclic;
  for (const options of [
    { method: "DELETE", protectedData: true },
    { method: "GET", protectedData: true, body: {} },
    { method: "POST", protectedData: false, body: {} },
    { method: "POST", protectedData: true, body: [] },
    { method: "POST", protectedData: true, body: { bad: Infinity } },
    { method: "POST", protectedData: true, body: cyclic },
    { method: "POST", protectedData: true, body: { large: "é".repeat(32768) } },
    { method: "PUT", protectedData: true, body: {}, ifMatch: '"1"\r\nAuthorization: wrong' },
    { method: "POST", protectedData: true, body: {}, etag: '"1"' },
  ]) await assert.rejects(http.request("filters", options as RequestOptions));
  for (const path of ["https://evil.example/api/v1/filters", "/api/v1/../../account", "/api/v1/%2e%2e/account", "http://user:password@localhost/api/v1/filters", "/api/v1/filters#fragment"]) {
    await assert.rejects(http.request(path, { method: "POST", protectedData: true, body: {} }));
  }
  assert.equal(calls, 0);
});

test("POST redirects, oversized streams, malformed JSON and unexpected 304 fail closed without retries", async () => {
  for (const [response, code] of [
    [new Response(null, { status: 307, headers: { location: "https://evil.example/api/v1" } }), "unsafe_redirect"],
    [new Response(JSON.stringify({ large: "x".repeat(300) }), { headers: { "content-type": "application/json" } }), "upstream_response_too_large"],
    [new Response("{bad json", { headers: { "content-type": "application/json" } }), "invalid_upstream_response"],
    [new Response(null, { status: 304 }), "invalid_upstream_response"],
  ] as const) {
    let calls = 0;
    const http = new StatsApiHttpClient(config("http://localhost/api/v1", 100), async () => { calls++; return response; });
    await assert.rejects(http.request("filters/validate", { method: "POST", protectedData: true, body: {} }), (error) => error instanceof UpstreamError && error.problem.code === code);
    assert.equal(calls, 1);
  }
});

test("ambiguous POST network failures and timeouts are never resubmitted", async () => {
  for (const name of ["TimeoutError", "TypeError"]) {
    let calls = 0;
    const http = new StatsApiHttpClient(config("http://localhost/api/v1"), async () => {
      calls++; const error = new Error("private transport detail hg_test_never_log"); error.name = name; throw error;
    });
    await assert.rejects(http.request("filters", { method: "POST", protectedData: true, body: {}, idempotencyKey: "8f725545-48d9-4ba4-bb8e-b4ad5bf2ebd0" }), (error) => {
      assert.ok(error instanceof UpstreamError);
      assert.equal(error.problem.code, "upstream_unavailable");
      assert.equal(error.problem.detail.includes("private"), false);
      return true;
    });
    assert.equal(calls, 1);
  }
});

test("discovery cache coalesces fills and revalidates expired entries with ETag", async (t) => {
  const api = await startMockApi((request, response) => {
    if (request.url === "/api/v1" && request.headers["if-none-match"] === '"root-v1"') {
      response.writeHead(304); response.end(); return true;
    }
    return false;
  }); t.after(() => api.close());
  let now = 0;
  const discovery = new DiscoveryClient(new StatsApiHttpClient(config(api.baseUrl)), 10, () => now);
  const [a, b] = await Promise.all([discovery.sports(), discovery.sports()]);
  assert.deepEqual(a, ["mlb"]); assert.deepEqual(b, ["mlb"]);
  assert.equal(api.requests.filter((item) => item.path === "/api/v1").length, 1);
  now = 20;
  assert.deepEqual(await discovery.sports(), ["mlb"]);
  assert.equal(api.requests.filter((item) => item.path === "/api/v1").length, 2);
  assert.equal(api.requests.at(-1)?.ifNoneMatch, '"root-v1"');
});

test("redirects and cross-origin discovery URLs are rejected", async (t) => {
  const api = await startMockApi((request, response) => {
    if (request.url === "/api/v1/redirect") { response.writeHead(302, { location: "https://evil.example/api/v1" }); response.end(); return true; }
    return false;
  }); t.after(() => api.close());
  const http = new StatsApiHttpClient(config(api.baseUrl));
  await assert.rejects(http.get("redirect", { protectedData: false }), (error) => error instanceof UpstreamError && error.problem.code === "unsafe_redirect");
  assert.throws(() => http.resolve("https://evil.example/api/v1"), /unsafe or cross-origin/);
});

test("oversized successful discovery is rejected from Content-Length before parsing", async (t) => {
  const api = await startMockApi((request, response) => {
    if (request.url === "/api/v1") {
      response.writeHead(200, { "content-type": "application/json", "content-length": "1000" });
      response.end(JSON.stringify({ private: "must not be returned" }));
      return true;
    }
    return false;
  }); t.after(() => api.close());
  const http = new StatsApiHttpClient(config(api.baseUrl, 100));
  await assert.rejects(http.get("", { protectedData: false }), (error) => {
    assert.ok(error instanceof UpstreamError);
    assert.equal(error.problem.code, "upstream_response_too_large");
    assert.equal(error.problem.detail.includes("must not"), false);
    return true;
  });
});

test("oversized streamed problem JSON is bounded and hidden", async (t) => {
  const api = await startMockApi((request, response) => {
    if (request.url === "/api/v1/problem") {
      response.writeHead(400, { "content-type": "application/problem+json" });
      response.write(JSON.stringify({ code: "private_code", detail: "sensitive-" }));
      response.end("x".repeat(500));
      return true;
    }
    return false;
  }); t.after(() => api.close());
  const http = new StatsApiHttpClient(config(api.baseUrl, 80));
  await assert.rejects(http.get("problem", { protectedData: false }), (error) => {
    assert.ok(error instanceof UpstreamError);
    assert.equal(error.problem.code, "upstream_response_too_large");
    assert.equal(error.problem.detail.includes("sensitive"), false);
    return true;
  });
});
