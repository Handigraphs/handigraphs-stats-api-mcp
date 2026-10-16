import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { startMockApi, startAgentMockApi } from "./mock-api.js";

test("official MCP client communicates with the built server over stdio", async (t) => {
  const api = await startMockApi(); t.after(() => api.close());
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [resolve(".test-dist/src/index.js")],
    env: { HANDIGRAPHS_API_KEY: "hg_test_stdio", HANDIGRAPHS_API_BASE_URL: api.baseUrl, HANDIGRAPHS_HTTP_TIMEOUT_MS: "2000" },
    stderr: "pipe",
  });
  let stderr = ""; transport.stderr?.on("data", (chunk) => { stderr += String(chunk); });
  const client = new Client({ name: "stdio-test", version: "1.0.0" });
  t.after(async () => { await client.close(); });
  await client.connect(transport);
  assert.equal(client.getServerVersion()?.version, "0.2.7");
  const listed = await client.callTool({ name: "list_resources", arguments: { sport: "mlb" } });
  assert.equal(listed.isError, undefined);
  assert.match(((listed as { content: Array<{ text: string }> }).content[0]?.text ?? ""), /batters/);
  assert.equal(stderr.includes("hg_test_stdio"), false);
});

test("official stdio client validates and runs a saved filter without saving or leaking credentials", async (t) => {
  const api = await startAgentMockApi(); t.after(() => api.close());
  const transport = new StdioClientTransport({
    command: process.execPath, args: [resolve(".test-dist/src/index.js")],
    env: { HANDIGRAPHS_API_KEY: "hg_test_stdio", HANDIGRAPHS_API_BASE_URL: api.baseUrl, HANDIGRAPHS_HTTP_TIMEOUT_MS: "2000" }, stderr: "pipe",
  });
  let stderr = ""; transport.stderr?.on("data", (chunk) => { stderr += String(chunk); });
  const client = new Client({ name: "stdio-agent-test", version: "1" });
  t.after(() => client.close());
  await client.connect(transport);
  assert.equal((await client.listTools()).tools.length, 12);
  for (const name of ["validate_filter", "run_filter"]) {
    const result = await client.callTool({ name, arguments: { filter_id: 42, revision: 7 } });
    assert.equal(result.isError, undefined);
    assert.equal(JSON.stringify(result).includes("hg_test_stdio"), false);
    assert.match(JSON.stringify(result), /"persisted":false/);
  }
  assert.equal(api.requests.filter((request) => request.method === "POST").length, 2);
  assert.equal(api.requests.some((request) => request.path === "/api/v1/filters"), false);
  assert.equal(stderr.includes("hg_test_stdio"), false);
});

test("Codex setup mode starts without a key and exposes only setup", async (t) => {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [resolve(".test-dist/src/index.js")],
    env: { HANDIGRAPHS_CODEX_SETUP: "1" },
    stderr: "pipe",
  });
  const client = new Client({ name: "stdio-setup-test", version: "1.0.0" });
  t.after(async () => { await client.close(); });
  await client.connect(transport);
  assert.deepEqual((await client.listTools()).tools.map((tool) => tool.name), ["configure_api_key"]);
});
