import assert from "node:assert/strict";
import test from "node:test";
import type { Config } from "../src/config.js";
import { DiscoveryClient } from "../src/discovery.js";
import { UpstreamError } from "../src/errors.js";
import { StatsApiHttpClient } from "../src/http.js";
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
