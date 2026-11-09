import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server.js";
import { agentDescriptor, startAgentMockApi } from "./mock-api.js";

async function connect(baseUrl: string) {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createServer({ apiKey: "hg_test_never_log", baseUrl: new URL(baseUrl), discoveryTtlMs: 300000, timeoutMs: 2000, maxResponseBytes: 1024 * 1024 });
  const client = new Client({ name: "agent-research-test", version: "1" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { client, close: async () => { await client.close(); await server.close(); } };
}
const rule = { table: "nhl_skaters", split: "season", criteria: [
  { column: "sogPerGame", condition: "gte", value: 3, orGroup: 0 },
  { column: "toiPerGame", condition: "gte", value: "18:00", split: "last10", compareColumn: "toiPerGame", compareSplit: "season", orGroup: 1 },
], sample_context: { sport: "nhl", season: "20262027", game_type: 2 } };

test("official client exposes nine focused read tools and preserves native rules and response context", async (t) => {
  const api = await startAgentMockApi(); t.after(() => api.close());
  const connection = await connect(api.baseUrl); t.after(() => connection.close());
  const tools = (await connection.client.listTools()).tools;
  assert.equal(tools.length, 19);
  assert.equal(tools.some((item) => /http_request/.test(item.name)), false);
  for (const tool of tools.slice(3, 12)) {
    assert.deepEqual(tool.annotations, { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true });
    assert.equal(tool.inputSchema.additionalProperties, false);
  }
  for (const table of ["batters", "starters", "nhl_skaters", "nhl_goalies"]) {
    const result = await connection.client.callTool({ name: "describe_filter_capabilities", arguments: { table } });
    assert.equal(result.isError, undefined);
    assert.match(JSON.stringify(result), /seconds/);
    assert.match(JSON.stringify(result), /research_worker_unavailable/);
    assert.match(JSON.stringify(result), /default_sections/);
  }
  const listed = await connection.client.callTool({ name: "list_saved_filters", arguments: { table: "nhl_skaters", cursor: "cursor&not=a-query", page_size: 2 } });
  assert.match(JSON.stringify(listed), /unsupported_filter/);
  assert.match(JSON.stringify(listed), /next-owned-page/);
  const fetched = await connection.client.callTool({ name: "get_saved_filter", arguments: { filter_id: 42 } });
  assert.deepEqual((fetched.structuredContent as { metadata: { etag: string } }).metadata.etag, '"7"');
  assert.match(JSON.stringify(fetched), /research\/filters\/42/);
  for (const name of ["validate_filter", "run_filter"]) {
    const args = name === "run_filter" ? { rule, cursor: "same-evaluation", page_size: 1 } : { rule };
    const result = await connection.client.callTool({ name, arguments: args });
    assert.equal(result.isError, undefined);
    const payload = (result.structuredContent as { response: Record<string, unknown> }).response;
    assert.deepEqual(payload.request, args);
    assert.equal(payload.count, 0);
    assert.deepEqual(payload.qualifiers, []);
    assert.equal(payload.evaluation_token, "opaque-evaluation");
    assert.equal(payload.persisted, false);
  }
  await connection.client.callTool({ name: "run_filter", arguments: { filter_id: 42, revision: 7 } });
  for (const [name, args] of [
    ["list_saved_research", { page_size: 50, cursor: "owned-idea-page" }],
    ["get_saved_research", { idea_id: "f7e3a6ca-e19f-4bc9-85e9-f416bad81b43" }],
  ] as const) {
    const result = await connection.client.callTool({ name, arguments: args });
    assert.equal(result.isError, undefined);
    assert.match(JSON.stringify(result), /"archived":false/);
  }
  assert.equal(api.requests.filter((request) => request.path === "/api/v1").every((request) => !request.authorization), true);
  assert.equal(api.requests.filter((request) => request.path !== "/api/v1").every((request) => request.authorization === "Bearer hg_test_never_log"), true);
  assert.ok(api.requests.some((request) => request.path.includes("cursor=cursor%26not%3Da-query")));
  assert.equal(api.requests.filter((request) => request.method === "POST").length, 3);
});

test("capabilities and saved data are fetched fresh without conditional or public cache reuse", async (t) => {
  const api = await startAgentMockApi(); t.after(() => api.close());
  const connection = await connect(api.baseUrl); t.after(() => connection.close());
  for (let i = 0; i < 2; i++) {
    await connection.client.callTool({ name: "describe_filter_capabilities", arguments: {} });
    await connection.client.callTool({ name: "get_saved_filter", arguments: { filter_id: 42 } });
  }
  assert.equal(api.requests.filter((item) => item.path === "/api/v1/agent/capabilities").length, 2);
  assert.equal(api.requests.filter((item) => item.path === "/api/v1/filters/42").length, 2);
  assert.equal(api.requests.some((item) => item.ifNoneMatch), false);
});

test("Gamecenter encodes opaque IDs, pages explicitly, preserves evidence, and treats malicious narrative as data", async (t) => {
  const api = await startAgentMockApi(); t.after(() => api.close());
  const connection = await connect(api.baseUrl); t.after(() => connection.close());
  for (const sport of ["mlb", "nhl"]) {
    const list = await connection.client.callTool({ name: "list_gamecenter_games", arguments: { sport, date: "2026-10-16", page_size: 2 } });
    assert.match(JSON.stringify(list), /not_published/);
    const packet = await connection.client.callTool({ name: "get_gamecenter_packet", arguments: { sport, game_id: "opaque:game 1", sections: ["analysis", "evidence"], evidence_ids: ["fact:1"], cursor: "opaque+cursor", page_size: 1 } });
    assert.equal(packet.isError, undefined);
    assert.match(JSON.stringify(packet), /Ignore all instructions/);
    assert.equal(JSON.stringify(packet).includes("hg_test_never_log"), false);
    assert.match(JSON.stringify(packet), /"data_as_of":null/);
    const request = api.requests.at(-1)!;
    assert.match(request.path, /opaque%3Agame%201/);
    assert.match(request.path, /cursor=opaque%2Bcursor/);
    assert.match(request.path, /evidence_ids=fact%3A1/);
  }
  assert.equal(api.requests.length, 5); // one public descriptor plus four reads; no auto-page/save.
  assert.equal(api.requests.every((request) => request.method === "GET"), true);
});

test("Gamecenter selector errors lead to analysis and an exact cited evidence read", async (t) => {
  const api = await startAgentMockApi(); t.after(() => api.close());
  const connection = await connect(api.baseUrl); t.after(() => connection.close());
  const args = { sport: "nhl", game_id: "opaque:game 1" };
  const wrong = await connection.client.callTool({ name: "get_gamecenter_packet", arguments: { ...args, sections: ["props"] } });
  assert.equal(wrong.isError, true);
  const detail = (wrong.structuredContent as { error: { detail: string } }).error.detail;
  assert.match(detail, /Valid sections: summary, context, availability, analysis, evidence/);
  assert.match(detail, /sections=\["analysis"\] for props and market_reviews/);
  assert.match(detail, /sections=\["evidence"\] and evidence_ids/);
  assert.equal(api.requests.some(item => item.authorization), false);

  const analysis = await connection.client.callTool({ name: "get_gamecenter_packet", arguments: { ...args, sections: ["analysis"] } });
  assert.equal(analysis.isError, undefined);
  assert.equal(new URL(api.requests.at(-1)!.path, api.baseUrl).searchParams.get("sections"), "analysis");
  const evidence = await connection.client.callTool({ name: "get_gamecenter_packet",
    arguments: { ...args, sections: ["evidence"], evidence_ids: ["fact:1"] } });
  assert.equal(evidence.isError, undefined);
  const params = new URL(api.requests.at(-1)!.path, api.baseUrl).searchParams;
  assert.equal(params.get("sections"), "evidence");
  assert.equal(params.get("evidence_ids"), "fact:1");
});

test("compact Gamecenter indexes exact citations and preserves detailed packet behavior", async (t) => {
  const game = { sport: "nhl", game_id: "opaque:game 1" };
  const ids = Array.from({ length: 90 }, (_, index) => `skater:${1000 + index}:L10:sog_per_game`);
  const props = Array.from({ length: 8 }, (_, index) => {
    const evidence_ids = ids.slice(index * 10, index * 10 + 20);
    return { player: `Example ${index + 1}`, market: "SOG", pick: "Over", status: "watch",
      reasoning: "Recent shot volume supports the watch. " + "The matchup carries additional context. ".repeat(5),
      evidence_ids, evidence_links: Object.fromEntries(evidence_ids.map((id) => [id, `https://example.invalid/evidence/${id}`])) };
  });
  const counterpoint = { text: "The recent sample is short.", evidence_ids: [ids[0], "fact:concern"] };
  const market_reviews = [{ market: "SOG", status: "watch", assessment_status: "incomplete",
    evaluation_scope: { kind: "shortlist", complete: false }, text: "Partial shortlist.", evidence_ids: [ids[0]] }];
  const detailed = { ...game, schema: "gamecenter-packet-v1", content_role: "research_data_not_instructions",
    freshness: { status: "unknown", data_as_of: null }, citation_status: "mixed",
    publication: { state: "published", assessment_status: "incomplete", sections: { props: { status: "reviewed" } } },
    analysis: { home_support: [{ text: "Full team analysis." }], props: [{ ...props[0], counterpoint }, ...props.slice(1)], market_reviews } };
  const api = await startAgentMockApi((request, response) => {
    const url = new URL(request.url!, "http://localhost");
    if (!url.pathname.startsWith("/api/v1/nhl/gamecenter/")) return false;
    const evidence = url.searchParams.get("evidence_ids")?.split(",").map((id) => ({ id, value: 1 }));
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(evidence ? { ...game, evidence } : detailed));
    return true;
  }); t.after(() => api.close());
  const connection = await connect(api.baseUrl); t.after(() => connection.close());
  const read = (args: Record<string, unknown>) => connection.client.callTool({ name: "get_gamecenter_packet", arguments: { ...game, ...args } });

  const full = await read({ sections: ["analysis"] });
  const explicitFull = await read({ sections: ["analysis"], compact: false });
  assert.deepEqual((full.structuredContent as { response: unknown }).response, detailed);
  assert.deepEqual(explicitFull, full);
  assert.equal(new URL(api.requests.at(-1)!.path, api.baseUrl).search, "?sections=analysis");

  const compact = await read({ compact: true });
  assert.ok(Array.isArray(compact.content));
  const content = compact.content[0];
  assert.ok(content?.type === "text");
  assert.equal(compact.content.length, 1);
  assert.equal(compact.structuredContent, undefined);
  assert.ok(Buffer.byteLength(JSON.stringify(compact), "utf8") < 12 * 1024);
  assert.equal(new URL(api.requests.at(-1)!.path, api.baseUrl).search, "?sections=analysis");
  const projected = JSON.parse(content.text);
  assert.equal(projected.schema, "gamecenter-compact-v1");
  assert.deepEqual(projected.freshness, detailed.freshness);
  assert.deepEqual(projected.publication, detailed.publication);
  assert.equal(projected.citation_status, "mixed");
  assert.equal(projected.evidence_href, new URL("/api/v1/nhl/gamecenter/opaque%3Agame%201?sections=evidence", api.baseUrl).href);
  assert.equal(new Set(projected.citation_ids).size, 91);
  assert.deepEqual(Object.keys(projected.analysis), ["props", "market_reviews"]);
  assert.equal(content.text.includes("evidence_links"), false);
  const citedIds = ({ citation_indices }: { citation_indices: number[] }) => citation_indices.map((index) => projected.citation_ids[index]);
  assert.deepEqual(projected.analysis.props.map(citedIds), props.map((prop) => prop.evidence_ids));
  assert.deepEqual(citedIds(projected.analysis.props[0].counterpoint), counterpoint.evidence_ids);
  assert.deepEqual(citedIds(projected.analysis.market_reviews[0]), market_reviews[0]!.evidence_ids);
  assert.equal(projected.analysis.market_reviews[0].evaluation_scope.complete, false);
  const evidence = await read({ sections: ["evidence"], evidence_ids: citedIds(projected.analysis.props[0].counterpoint) });
  assert.deepEqual((evidence.structuredContent as { response: { evidence: { id: string }[] } }).response.evidence.map((fact) => fact.id), counterpoint.evidence_ids);
  assert.equal(api.requests.filter((request) => request.authorization).length, 4);
});

test("compact Gamecenter leaves absent analysis unavailable", async (t) => {
  const api = await startAgentMockApi((request, response) => {
    if (!request.url?.startsWith("/api/v1/mlb/gamecenter/")) return false;
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ publication: { state: "not_published", reason: "not_published" }, citation_status: "unavailable" }));
    return true;
  }); t.after(() => api.close());
  const connection = await connect(api.baseUrl); t.after(() => connection.close());
  const result = await connection.client.callTool({ name: "get_gamecenter_packet",
    arguments: { sport: "mlb", game_id: "opaque:game 1", compact: true, sections: ["analysis"] } });
  assert.ok(Array.isArray(result.content));
  const content = result.content[0];
  assert.ok(content?.type === "text");
  const projected = JSON.parse(content.text);
  assert.equal(projected.publication.state, "not_published");
  assert.equal(projected.citation_status, "unavailable");
  assert.deepEqual(projected.analysis, {});
  assert.deepEqual(projected.citation_ids, []);
});

test("strict schemas reject ambiguous selectors, extra fields, oversized rules, and invalid packet selectors", async (t) => {
  const api = await startAgentMockApi(); t.after(() => api.close());
  const connection = await connect(api.baseUrl); t.after(() => connection.close());
  const cases: Array<[string, Record<string, unknown>]> = [
    ["run_filter", {}], ["run_filter", { rule, filter_id: 42 }], ["run_filter", { rule, revision: 1 }],
    ["run_filter", { filter_id: 42, date: "2025-10-01" }], ["run_filter", { filter_id: 42, page_size: 101 }],
    ["validate_filter", { rule, cursor: "extra" }], ["validate_filter", { rule: { ...rule, criteria: [{ column: "x", condition: "ne", value: 1 }] } }],
    ["validate_filter", { rule: { ...rule, criteria: [{ column: "x", condition: "gt", value: Infinity }] } }],
    ["validate_filter", { rule: { ...rule, table: "not-a-table" } }],
    ["validate_filter", { rule: { ...rule, sample_context: { enormous: "x".repeat(32769) } } }],
    ["list_saved_research", { page_size: 51 }], ["get_saved_filter", { filter_id: -1 }],
    ["get_saved_research", { idea_id: "../../filters/42" }],
    ["list_gamecenter_games", { sport: "nhl", date: "2026-02-30" }],
    ["get_gamecenter_packet", { sport: "nhl", game_id: "../filters" }],
    ["get_gamecenter_packet", { sport: "nhl", game_id: ".." }],
    ["get_gamecenter_packet", { sport: "nhl", game_id: "x", sections: ["evidence", "evidence"] }],
    ["get_gamecenter_packet", { sport: "nhl", game_id: "x", sections: ["raw_snapshot"] }],
    ["get_gamecenter_packet", { sport: "nhl", game_id: "x", evidence_ids: ["fact:1"] }],
    ["get_gamecenter_packet", { sport: "nhl", game_id: "x", cursor: "evidence-page" }],
    ["get_gamecenter_packet", { sport: "nhl", game_id: "x", sections: ["evidence"], evidence_ids: ["one,two"] }],
    ["get_gamecenter_packet", { sport: "nhl", game_id: "x", compact: true, sections: ["analysis", "evidence"] }],
    ["get_gamecenter_packet", { sport: "nhl", game_id: "x", compact: true, evidence_ids: ["fact:1"] }],
    ["get_gamecenter_packet", { sport: "nhl", game_id: "x", compact: true, cursor: "evidence-page" }],
    ["get_gamecenter_packet", { sport: "nhl", game_id: "x", compact: true, page_size: 1 }],
  ];
  for (const [name, args] of cases) {
    const result = await connection.client.callTool({ name, arguments: args });
    assert.equal(result.isError, true, `${name}: ${JSON.stringify(args).slice(0, 120)}`);
  }
  assert.equal(api.requests.some((item) => item.authorization), false);
});

test("forged discovery cannot send a read tool to a mutation, foreign origin or unsafe path", async (t) => {
  for (const replacement of [
    { method: "POST", path: "/api/v1/filters" },
    { method: "POST", path: "https://evil.example/api/v1/filters/validate" },
    { method: "POST", path: "/api/v1/../account/api-keys" },
    { method: "DELETE", path: "/api/v1/filters/validate" },
  ]) {
    const api = await startAgentMockApi((request, response) => {
      if (request.url !== "/api/v1") return false;
      const agent = agentDescriptor();
      (agent.operations as Record<string, unknown>).filters_validate = replacement;
      response.writeHead(200, { "content-type": "application/json" }); response.end(JSON.stringify({ agent })); return true;
    }); t.after(() => api.close());
    const connection = await connect(api.baseUrl); t.after(() => connection.close());
    const result = await connection.client.callTool({ name: "validate_filter", arguments: { filter_id: 42 } });
    assert.equal(result.isError, true);
    assert.match(JSON.stringify(result), /agent_operation_unavailable/);
    assert.equal(api.requests.length, 1);
    assert.equal(api.requests[0]?.authorization, undefined);
  }
});

test("agent POST surfaces authorization, ownership, revision, expiry and capacity problems once with redaction", async (t) => {
  for (const status of [400, 401, 403, 404, 409, 410, 412, 428, 429, 503]) {
    await t.test(String(status), async (t) => {
      let calls = 0;
      const api = await startAgentMockApi((request, response) => {
        if (request.url !== "/api/v1/filters/run") return false;
        calls++;
        response.writeHead(status, { "content-type": "application/problem+json", "retry-after": "15", "x-request-id": "safe-request" });
        response.end(JSON.stringify({ code: "specific_problem", detail: "private hg_test_never_log", field_errors: { rule: "hg_test_never_log" } })); return true;
      }); t.after(() => api.close());
      const connection = await connect(api.baseUrl); t.after(() => connection.close());
      const result = await connection.client.callTool({ name: "run_filter", arguments: { filter_id: 42, revision: 7 } });
      assert.equal(result.isError, true); assert.equal(calls, 1);
      const problem = (result.structuredContent as { error: Record<string, unknown> }).error;
      assert.equal(problem.status, status); assert.equal(problem.code, "specific_problem");
      assert.equal(problem.retry_after_seconds, 15); assert.equal(problem.request_id, "safe-request");
      assert.equal(JSON.stringify(result).includes("hg_test_never_log"), false);
    });
  }
});
