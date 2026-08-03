import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createSetupServer, getSetupLaunchSpec } from "../src/setup.js";

test("setup launch specifications cover Windows and macOS", () => {
  const windows = getSetupLaunchSpec("win32");
  assert.equal(windows?.command, "powershell.exe");
  assert.match(windows?.args.at(-1) ?? "", /configure-windows\.ps1$/);
  assert.equal(windows?.windowsHide, false);
  assert.equal(windows?.launchCheckMs, 0);

  const macos = getSetupLaunchSpec("darwin");
  assert.equal(macos?.command, process.execPath);
  assert.match(macos?.args.at(-1) ?? "", /configure-macos\.mjs$/);
  assert.equal(macos?.windowsHide, true);
  assert.equal(macos?.launchCheckMs, 1_000);

  assert.equal(getSetupLaunchSpec("linux"), undefined);
});

test("cancelled setup does not request a restart", async (t) => {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createSetupServer(async () => ({
    status: "cancelled",
    message: "Handigraphs setup was cancelled. No credential was changed.",
  }));
  const client = new Client({ name: "setup-cancel-test", version: "1.0.0" });
  t.after(async () => { await client.close(); await server.close(); });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  const result = await client.callTool({ name: "configure_api_key", arguments: {} });
  assert.deepEqual(result.structuredContent, {
    status: "cancelled",
    secret_received_by_model: false,
    restart_required: false,
  });
});

test("missing-key server exposes only argument-free secure setup", async (t) => {
  let launches = 0;
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createSetupServer(async () => {
    launches += 1;
    return { status: "launched", message: "Secure setup window opened." };
  });
  const client = new Client({ name: "setup-test", version: "1.0.0" });
  t.after(async () => { await client.close(); await server.close(); });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  const tools = (await client.listTools()).tools;
  assert.deepEqual(tools.map((tool) => tool.name), ["configure_api_key"]);
  assert.equal(tools[0]?.inputSchema.type, "object");
  assert.deepEqual(tools[0]?.inputSchema.properties, {});

  const result = await client.callTool({ name: "configure_api_key", arguments: {} });
  assert.equal(result.isError, undefined);
  assert.equal(launches, 1);
  assert.deepEqual(result.structuredContent, {
    status: "launched",
    secret_received_by_model: false,
    restart_required: true,
  });
});

test("setup launch failure is generic and never requests a secret argument", async (t) => {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createSetupServer(async () => { throw new Error("private setup failure"); });
  const client = new Client({ name: "setup-failure-test", version: "1.0.0" });
  t.after(async () => { await client.close(); await server.close(); });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  const result = await client.callTool({ name: "configure_api_key", arguments: {} });
  const text = (result as { content: Array<{ text: string }> }).content[0]?.text ?? "";
  assert.equal(result.isError, true);
  assert.equal(text.includes("private setup failure"), false);
  assert.match(text, /never paste the key into chat/i);
});
