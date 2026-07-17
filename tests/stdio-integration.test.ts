import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { startMockApi } from "./mock-api.js";

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
  const listed = await client.callTool({ name: "list_resources", arguments: { sport: "mlb" } });
  assert.equal(listed.isError, undefined);
  assert.match(((listed as { content: Array<{ text: string }> }).content[0]?.text ?? ""), /batters/);
  assert.equal(stderr.includes("hg_test_stdio"), false);
});
