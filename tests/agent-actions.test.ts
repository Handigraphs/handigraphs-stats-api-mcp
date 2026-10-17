import assert from "node:assert/strict";
import test from "node:test";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server.js";
import { startActionMockApi, startMockApi, MOCK_JOB_ID, MOCK_IDEA_ID, agentDescriptor } from "./mock-api.js";

async function connect(baseUrl: string) {
  const [a, b] = InMemoryTransport.createLinkedPair();
  const server = createServer({ apiKey: "hg_test_actions", baseUrl: new URL(baseUrl), timeoutMs: 2000, discoveryTtlMs: 300000, maxResponseBytes: 1024 * 1024 });
  const client = new Client({ name: "action-test", version: "1" });
  await Promise.all([client.connect(a), server.connect(b)]);
  return { client, close: async () => { await client.close(); await server.close(); } };
}
const operation_id = "3600b508-8aa9-4148-be37-cbed6b6a1253";
const rule = { table: "nhl_skaters", split: "season", criteria: [{ column: "stats.shotsPerGame", condition: "gte", value: 3 }, { column: "stats.timeOnIcePerGame", condition: "gte", value: 1080 }] };
const settings = { start_date: "2025-10-01", end_date: "2026-04-15", season: 20252026, game_type: 2, market: "sog", side: "over", line: 2.5, min_sample: 25 };
const definition = { hypothesis: "Volume shooters", config: { ...rule, season: 20252026, game_type: 2, window: { preset: "custom", start_date: settings.start_date, end_date: settings.end_date }, market: "sog", side: "over", line: 2.5, min_sample: 25 } };

test("save pairs exact settings, retries one operation without duplicates and rejects changed-body reuse", async (t) => {
  const api = await startActionMockApi(); t.after(() => api.close());
  const { client, close } = await connect(api.baseUrl); t.after(close);
  const args = { operation_id, name: "Volume shooters", rule, research_idea: { name: "Volume research", definition } };
  const first = await client.callTool({ name: "save_filter", arguments: args });
  const retry = await client.callTool({ name: "save_filter", arguments: args });
  assert.equal(first.isError, undefined); assert.equal(retry.isError, undefined);
  assert.equal(api.effects.filters, 1); assert.equal(api.effects.ideas, 1);
  const response = (first.structuredContent as { response: Record<string, unknown> }).response;
  assert.deepEqual((response.research_idea as Record<string, unknown>).definition, definition);
  assert.match(JSON.stringify(first), /research\/ideas/);
  assert.match(JSON.stringify(retry), /"replayed":true/);
  const request = api.requests.find((item) => item.method === "POST")!;
  assert.equal(request.idempotencyKey, operation_id);
  assert.equal(JSON.parse(request.body!).operation_id, undefined);
  const conflict = await client.callTool({ name: "save_filter", arguments: { ...args, name: "Different" } });
  assert.equal(conflict.isError, true); assert.match(JSON.stringify(conflict), /idempotency_conflict/);
  assert.equal(api.effects.filters, 1);
});

test("updates require revisions, send If-Match for filters and retain upstream conflicts without silent copies", async (t) => {
  const api = await startActionMockApi(); t.after(() => api.close());
  const { client, close } = await connect(api.baseUrl); t.after(close);
  const args = { filter_id: 42, revision: 7, name: "Updated", rule };
  assert.equal((await client.callTool({ name: "update_saved_filter", arguments: args })).isError, undefined);
  assert.equal(api.requests.at(-1)?.ifMatch, '"7"');
  assert.equal(JSON.parse(api.requests.at(-1)!.body!).revision, undefined);
  const stale = await client.callTool({ name: "update_saved_filter", arguments: args });
  assert.equal(stale.isError, true); assert.match(JSON.stringify(stale), /filter_revision_conflict/);
  const idea = { idea_id: MOCK_IDEA_ID, revision: 2, name: "Updated research", definition };
  assert.equal((await client.callTool({ name: "update_saved_research", arguments: idea })).isError, undefined);
  assert.equal(JSON.parse(api.requests.at(-1)!.body!).revision, 2);
  assert.equal((await client.callTool({ name: "update_saved_research", arguments: idea })).isError, true);
  assert.equal(api.effects.filters, 0); assert.equal(api.effects.ideas, 0);
  assert.equal(api.effects.filterRevision, 8); assert.equal(api.effects.ideaRevision, 3);
});

test("research submission, interrupted resume, partial results and cancellation retain exact inputs with no automatic polling", async (t) => {
  const api = await startActionMockApi(); t.after(() => api.close());
  const { client, close } = await connect(api.baseUrl); t.after(close);
  const args = { operation_id, rule, ...settings };
  const first = await client.callTool({ name: "start_filter_research", arguments: args });
  assert.equal(first.isError, undefined);
  assert.equal(api.requests.length, 2); // discovery + one submission only
  assert.equal((first.structuredContent as { metadata: { retry_after_seconds: number } }).metadata.retry_after_seconds, 5);
  await client.callTool({ name: "start_filter_research", arguments: args });
  assert.equal(api.effects.jobs, 1);
  const recent = await client.callTool({ name: "list_filter_research", arguments: { limit: 25 } });
  assert.equal(recent.isError, undefined); assert.match(api.requests.at(-1)!.path, /limit=25/);
  for (const mode of ["status", "result"]) {
    const read = await client.callTool({ name: "get_filter_research", arguments: { job_id: MOCK_JOB_ID, mode } });
    assert.equal(read.isError, undefined);
    const job = (read.structuredContent as { response: { job: Record<string, unknown> } }).response.job;
    assert.equal(job.status, "partial"); assert.equal(job.outcome_status, "failed");
    const { operation_id: _, ...body } = args;
    assert.deepEqual(job.request, body);
    assert.match(JSON.stringify(job), /"roi":null/);
    assert.match(JSON.stringify(job), /foreground_deadline_seconds/);
  }
  for (let i = 0; i < 2; i++) {
    const cancel = await client.callTool({ name: "cancel_filter_research", arguments: { job_id: MOCK_JOB_ID } });
    assert.equal(cancel.isError, undefined); assert.match(JSON.stringify(cancel), /cancel_requested/);
    assert.equal(api.requests.at(-1)?.body, undefined);
  }
  assert.equal(api.effects.cancels, 1); assert.equal(api.effects.jobs, 1);
  assert.equal(api.effects.filters, 0);
});

test("all four native targets pass exact declared settings without translating metrics or units", async (t) => {
  const api = await startActionMockApi(); t.after(() => api.close());
  const { client, close } = await connect(api.baseUrl); t.after(close);
  const tables = ["batters", "starters", "nhl_skaters", "nhl_goalies"];
  for (const [index, table] of tables.entries()) {
    const { game_type: _, ...common } = settings;
    const args = { ...common, operation_id: `3600b508-8aa9-4148-be37-cbed6b6a125${index}`, rule: { ...rule, table }, ...(table.startsWith("nhl_") ? { game_type: 2 } : { phase: "regular", season: 2026 }) };
    const result = await client.callTool({ name: "start_filter_research", arguments: args });
    assert.equal(result.isError, undefined);
    assert.deepEqual(JSON.parse(api.requests.at(-1)!.body!).rule, args.rule);
  }
});

test("strict schemas reject missing intent-independent safety fields, ambiguous selectors and invalid windows before protected calls", async (t) => {
  const api = await startActionMockApi(); t.after(() => api.close());
  const { client, close } = await connect(api.baseUrl); t.after(close);
  for (const [name, args] of [
    ["save_filter", { name: "No operation", rule }],
    ["save_filter", { operation_id, name: "Unknown confirmation", rule, confirmed: true }],
    ["update_saved_filter", { filter_id: 42, name: "No revision", rule }],
    ["update_saved_research", { idea_id: MOCK_IDEA_ID, name: "No revision", definition }],
    ["save_filter", { operation_id, name: "Relative dates", rule, research_idea: { name: "No dates", definition: { config: { ...definition.config, window: { preset: "last30" } } } } }],
    ["start_filter_research", { operation_id, ...settings }],
    ["start_filter_research", { operation_id, filter_id: 42, ...settings }],
    ["start_filter_research", { operation_id, filter_id: 42, revision: 7, rule, ...settings }],
    ["start_filter_research", { operation_id, rule, revision: 7, ...settings }],
    ["start_filter_research", { operation_id, rule, ...settings, end_date: "2025-01-01" }],
    ["start_filter_research", { operation_id, rule, ...settings, end_date: "2027-10-01" }],
    ["start_filter_research", { operation_id, rule, ...settings, phase: "regular" }],
    ["start_filter_research", { operation_id, rule: { ...rule, table: "batters" }, ...settings }],
    ["start_filter_research", { operation_id, rule: { ...rule, sample_context: { giant: "x".repeat(32768) } }, ...settings }],
    ["cancel_filter_research", { job_id: MOCK_JOB_ID, operation_id }],
    ["get_filter_research", { job_id: "../../filters", mode: "result" }],
    ["list_filter_research", { limit: 26 }],
  ] as Array<[string, Record<string, unknown>]>) {
    assert.equal((await client.callTool({ name, arguments: args })).isError, true, name);
  }
  assert.equal(api.requests.some((request) => request.authorization), false);
});

test("old servers and forged operation discovery cannot invoke mutations", async (t) => {
  const old = await startMockApi(); t.after(() => old.close());
  const oldClient = await connect(old.baseUrl); t.after(oldClient.close);
  const result = await oldClient.client.callTool({ name: "save_filter", arguments: { operation_id, name: "No save", rule } });
  assert.equal(result.isError, true); assert.match(JSON.stringify(result), /agent_api_unavailable/);
  for (const path of ["https://evil.example/api/v1/filters", "/api/v1/research/jobs", "/api/v1/../account/api-keys"]) {
    const api = await startActionMockApi((request, response) => {
      if (request.url !== "/api/v1") return false;
      const agent = agentDescriptor(); (agent.operations as Record<string, unknown>).filters_save = { method: "POST", path };
      response.writeHead(200, { "content-type": "application/json" }); response.end(JSON.stringify({ agent })); return true;
    }); t.after(() => api.close());
    const { client, close } = await connect(api.baseUrl); t.after(close);
    const res = await client.callTool({ name: "save_filter", arguments: { operation_id, name: "No save", rule } });
    assert.equal(res.isError, true); assert.equal(api.requests.length, 1);
  }
});

test("tool annotations distinguish account mutations, cancellation and private reads", async (t) => {
  const api = await startActionMockApi(); t.after(() => api.close());
  const { client, close } = await connect(api.baseUrl); t.after(close);
  const tools = (await client.listTools()).tools;
  for (const name of ["save_filter", "update_saved_filter", "update_saved_research", "start_filter_research", "cancel_filter_research"]) {
    assert.equal(tools.find((tool) => tool.name === name)?.annotations?.readOnlyHint, false);
  }
  for (const name of ["list_filter_research", "get_filter_research"]) assert.equal(tools.find((tool) => tool.name === name)?.annotations?.readOnlyHint, true);
  assert.equal(tools.find((tool) => tool.name === "save_filter")?.annotations?.idempotentHint, true);
  assert.equal(tools.find((tool) => tool.name === "update_saved_filter")?.annotations?.destructiveHint, true);
  assert.equal(tools.find((tool) => tool.name === "cancel_filter_research")?.annotations?.destructiveHint, true);
});

test("upstream permission, tracking, expiry, conflict and capacity problems pass through once without saving substitutes", async (t) => {
  for (const [status, code] of [[400, "unsupported_research_rule"], [401, "invalid_api_key"], [403, "stats_api_permission_required"], [409, "filter_used_by_tracking"], [410, "research_job_expired"], [412, "filter_revision_conflict"], [428, "filter_revision_required"], [429, "research_daily_limit"], [503, "research_worker_unavailable"]] as const) {
    let calls = 0;
    const api = await startActionMockApi((request, response) => {
      if (request.method !== "POST") return false;
      calls++; response.writeHead(status, { "content-type": "application/problem+json", "retry-after": "15" });
      response.end(JSON.stringify({ code, detail: "private hg_test_actions" })); return true;
    }); t.after(() => api.close());
    const { client, close } = await connect(api.baseUrl); t.after(close);
    const result = await client.callTool({ name: "start_filter_research", arguments: { operation_id, rule, ...settings } });
    assert.equal(result.isError, true); assert.equal(calls, 1);
    assert.equal(JSON.stringify(result).includes("hg_test_actions"), false);
    assert.equal((result.structuredContent as { error: { code: string; retry_after_seconds: number } }).error.code, code);
    assert.equal((result.structuredContent as { error: { retry_after_seconds: number } }).error.retry_after_seconds, 15);
    assert.equal(api.effects.filters, 0); assert.equal(api.effects.jobs, 0);
  }
});

test("agent sandbox audit refuses production targets and writes, and exposes only read-only summary evidence", async (t) => {
  const moduleUrl = pathToFileURL(resolve("scripts/audit-agent-sandbox.mjs")).href;
  const { auditConfiguration, auditAgentReads } = await import(moduleUrl);
  assert.throws(() => auditConfiguration({}, []));
  assert.throws(() => auditConfiguration({ HANDIGRAPHS_API_KEY: "hg_live_fake" }, []));
  assert.throws(() => auditConfiguration({ HANDIGRAPHS_API_KEY: "hg_test_fake", HANDIGRAPHS_API_BASE_URL: "https://www.handigraphs.com/api/v1" }, []));
  assert.throws(() => auditConfiguration({ HANDIGRAPHS_API_KEY: "hg_test_fake" }, ["--confirm-account-writes"]));
  assert.match(auditConfiguration({ HANDIGRAPHS_API_KEY: "hg_test_fake" }, []).base, /sandbox/);
  const api = await startActionMockApi(); t.after(() => api.close());
  const { client, close } = await connect(api.baseUrl); t.after(close);
  const summary = await auditAgentReads(client);
  assert.equal(summary.mutating_acceptance, "not_run"); assert.equal(summary.launch_approved, false);
  assert.equal(summary.capabilities.length, 4);
  assert.equal(api.requests.filter(request => request.method !== "GET").length, 0);
  assert.equal(api.requests.length, 8); // discovery, four tables, three owned lists
  assert.equal(api.effects.filters + api.effects.ideas + api.effects.jobs, 0);
  assert.doesNotMatch(JSON.stringify(summary), /hg_test|next-owned-page|unsupported_filter/);
});
