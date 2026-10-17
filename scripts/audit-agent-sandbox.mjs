#!/usr/bin/env node
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const SANDBOX = "https://handigraphs-sandbox-web-49829810d1bb.herokuapp.com/api/v1";
const TABLES = ["batters", "starters", "nhl_skaters", "nhl_goalies"];
const REQUIRED_TOOLS = ["list_resources", "describe_resource", "query_stats",
  "describe_filter_capabilities", "list_saved_filters", "get_saved_filter", "validate_filter", "run_filter",
  "list_saved_research", "get_saved_research", "list_gamecenter_games", "get_gamecenter_packet",
  "save_filter", "update_saved_filter", "update_saved_research", "start_filter_research",
  "list_filter_research", "get_filter_research", "cancel_filter_research"];

export function auditConfiguration(env, args) {
  assert.equal(args.length, 0, "This audit accepts no arguments or write confirmation; PR-09 owns mutating acceptance.");
  const key = env.HANDIGRAPHS_API_KEY?.trim() ?? "";
  assert.match(key, /^hg_test_[A-Za-z0-9_-]+$/, "HANDIGRAPHS_API_KEY must be a temporary sandbox hg_test_ key");
  const base = env.HANDIGRAPHS_API_BASE_URL?.replace(/\/+$/, "");
  assert.ok(!base || base === SANDBOX, "agent audit refuses non-sandbox HANDIGRAPHS_API_BASE_URL");
  return { key, base: SANDBOX };
}

// Read-only and bounded: four capability requests and one page of each owned list.
// Return only booleans/counts, never names, IDs, rules, raw problems or credentials.
export async function auditAgentReads(client) {
  const listed = (await client.listTools()).tools;
  for (const name of REQUIRED_TOOLS) assert.ok(listed.some(tool => tool.name === name), "Required tool missing");
  async function read(name, args) {
    const result = await client.callTool({ name, arguments: args });
    assert.ok(!result.isError, "Agent read returned an MCP error; inspect privately without saving raw output");
    const response = result.structuredContent?.response;
    assert.ok(response && typeof response === "object" && !Array.isArray(response), "Invalid response envelope");
    return response;
  }
  const capabilities = [];
  for (const table of TABLES) {
    const value = await read("describe_filter_capabilities", { table });
    assert.equal(value.table, table, "Capability table mismatch");
    assert.ok(Array.isArray(value.permissions), "Missing permissions");
    assert.ok(value.operations && typeof value.operations === "object", "Missing operations");
    capabilities.push({ table, filter_write: value.permissions.includes("filters:write"),
      research_run: value.permissions.includes("research:run"),
      submission_available: value.operations.jobs_submit?.available === true });
  }
  const filters = await read("list_saved_filters", { page_size: 1 });
  const ideas = await read("list_saved_research", { page_size: 1 });
  const jobs = await read("list_filter_research", { limit: 1 });
  for (const [value, key] of [[filters, "filters"], [ideas, "ideas"], [jobs, "jobs"]]) {
    assert.ok(Array.isArray(value[key]), "Invalid owned-list envelope");
  }
  return { audit: "agent-read-only", tool_count: listed.length, capabilities,
    first_page_counts: { filters: filters.filters.length, ideas: ideas.ideas.length, jobs: jobs.jobs.length },
    mutating_acceptance: "not_run", launch_approved: false };
}

async function main() {
  if (process.argv.slice(2).length === 1 && process.argv[2] === "--help") {
    process.stdout.write("Read-only sandbox agent audit. Set a temporary HANDIGRAPHS_API_KEY in the environment. No write flags; mutating acceptance belongs to PR-09.\n");
    return;
  }
  const { key, base } = auditConfiguration(process.env, process.argv.slice(2));
  const manifest = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [fileURLToPath(new URL("../dist/index.js", import.meta.url))],
    env: { HANDIGRAPHS_API_KEY: key, HANDIGRAPHS_API_BASE_URL: base, HANDIGRAPHS_HTTP_TIMEOUT_MS: "30000" },
    stderr: "pipe",
  });
  // Drain diagnostics without retaining or printing private server output.
  transport.stderr?.on("data", () => {});
  const client = new Client({ name: "handigraphs-agent-read-audit", version: "1" });
  try {
    await client.connect(transport);
    assert.equal(client.getServerVersion()?.version, manifest.version, "Handshake version mismatch");
    process.stdout.write(JSON.stringify(await auditAgentReads(client)) + "\n");
  } finally {
    await client.close();
    await transport.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(() => {
    // Fixed diagnostic: SDK/network/validation exceptions can contain private payloads.
    process.stderr.write("Agent sandbox audit failed. Check temporary sandbox credentials, target, capabilities and compatible server. No account writes were attempted.\n");
    process.exitCode = 1;
  });
}
