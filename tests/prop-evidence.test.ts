import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server.js";
import { startMockApi } from "./mock-api.js";

async function fixture(t: test.TestContext, mode = "enabled") {
  const api = await startMockApi((request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    const send = (body: unknown, status = 200) => {
      response.writeHead(status, { "content-type": "application/json" });
      response.end(JSON.stringify(body)); return true;
    };
    if (url.pathname === "/api/v1") return send({ sports: [{ id: "nhl" }] });
    if (url.pathname === "/api/v1/nhl") return send({ resources: [{
      id: "skaters", href: "/api/v1/nhl/skaters", metrics: "/api/v1/nhl/metrics?resource=skaters",
      splits: "/api/v1/nhl/splits?resource=skaters",
      filters: ["split", "metrics", "sort", "day", "page_size", "stat_format", "meta", ...(mode === "old" ? [] : ["matchup_market", "matchup_window"])],
    }], ...(mode === "old" ? {} : { prop_evidence: {
      contract_version: 1, method: "POST", path: mode === "unsafe" ? "/api/v1/filters" : "/api/v1/nhl/prop-evidence",
      enabled: mode !== "disabled", markets: [{ key: "skater_shots_on_goal" }, { key: "skater_goals" }, { key: "skater_anytime_goalscorer" }],
      ...(mode === "legacy_sections" ? {} : { sections: mode === "three_sections"
        ? ["hit_rates", "game_logs", "odds"] : ["hit_rates", "game_logs", "odds", "matchup", "opponent_recent"] }),
    } }) });
    if (url.pathname === "/api/v1/nhl/metrics") return send({ metrics: {
      sog_per_game: { scale: "numeric" }, icf_per_game: { scale: "numeric" }, games_played: { scale: "integer" },
    } });
    if (url.pathname === "/api/v1/nhl/splits") return send({ splits: [{ id: "L10" }],
      filters: { matchup_market: ["shots", "goals"], matchup_window: ["sea", "last5", "last10", "last20"] } });
    if (mode === "busy_slate" && url.pathname === "/api/v1/nhl/skaters") return send({ data: Array.from({ length: 12 }, (_, i) => ({
      entity: { id: String(8478460 + i), name: "Synthetic skater " + i, team: "BUF" },
      stats: { sog_per_game: 3.2, icf_per_game: 6.1, games_played: 10 },
      context: { opponent: "CBJ", day: "today", split: "L10", season: "20262027", matchup_market: "shots", matchup_window: "sea",
        matchup: { market: "shots", window: "sea", status: "available", rank: 4, tier: "favorable", value: 31.2,
          metric: "shots_on_goal_against_per_game", model_version: "nhl_opponent_rank_v1", source: "official_box_scores_verified_events",
          sample_size: 14, requested_sample_size: null, as_of_date: "2026-11-07", season: "20262027", game_type: 2,
          league_size: 32, last_game_date: "2026-11-06", source_updated_at: "2026-11-07T12:00:00Z", game_id: 42,
          attempts: { metric: "corsi_against_per_game", status: "available", rank: 2, value: 62.3, reason: null,
            source: "mapped_shot_attempts_verified_parsed_events" } } },
    })), meta: { pagination: { next_cursor: null }, data_as_of: "2026-11-07T12:00:00Z", metric_keys: ["sog_per_game", "icf_per_game", "games_played"] } });
    if (url.pathname === "/api/v1/nhl/skaters") return send({ data: [{ entity: { id: "8478460", name: "Synthetic skater" },
      stats: { sog_per_game: 3.2, icf_per_game: 6.1, games_played: 10 }, context: { matchup: { rank: 4, attempts: { rank: 2 } } } }] });
    if (url.pathname === "/api/v1/nhl/prop-evidence") {
      if (mode === "busy_slate") return send({ schema: "nhl-prop-evidence-v1", slate_date: "2026-11-07", season: "20262027",
        game_type: 2, market: "skater_shots_on_goal", sample_unit: "games", recent_limit: 10, history_cutoff: "before_slate_date_et",
        generated_at: "2026-11-07T16:00:00Z", cache: { history_cache: "hit", odds_cache: "hit" },
        data: Array.from({ length: 5 }, (_, i) => ({ player_id: String(8478460 + i), line: 2.5, name: "Synthetic skater " + i,
          hit_rates: { status: "available", recent: { over: { hits: 7, misses: 3, pushes: 0, sample_size: 10, observations: 10, missing: 0, hit_rate: 0.7 } } },
          game_logs: { status: "available", stat: "shots_on_goal", rows: Array.from({ length: 5 }, (_, game) => ({
            game_id: String(2026020000 + game), date: "2026-11-06", opponent: "CBJ", value: 3, toi_seconds: 1080, shot_attempts: 6,
          })) },
          odds: { over: { status: "available", price_american: -115, book: "DK", fetched_at: "2026-11-07T16:00:00Z",
            implied_probability: 0.5349, source_market_key: "player_shots_on_goal", game_id: "42" } },
        })) });
      if (mode === "busy") return send({ code: "stats_api_capacity_exceeded", detail: "Retry later" }, 503);
      return send(mode === "large" ? { large: "x".repeat(8192) } : { market: "skater_shots_on_goal", data: [{ player_id: "8478460",
        line: 2.5, hit_rates: { recent: { hits: 7, misses: 3, pushes: 0, sample_size: 10, hit_rate: 0.7 } },
        odds: { over: { status: "available", price_american: -115, book: "DK", fetched_at: "2026-11-07T16:00:00Z" } } }] });
    }
    return false;
  });
  t.after(() => api.close());
  const server = createServer({ apiKey: "synthetic-delegated-credential", baseUrl: new URL(api.baseUrl),
    timeoutMs: 1000, discoveryTtlMs: 300000, maxResponseBytes: 1024 * 1024 }, { enablePropEvidence: true });
  const client = new Client({ name: "direct-url-client-without-skill", version: "1" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  t.after(async () => { await client.close(); await server.close(); });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { api, client };
}

const request = { market: "skater_shots_on_goal", player_ids: ["8478460"], sections: ["hit_rates", "odds", "game_logs"] };

test("direct clients discover the two-call workflow and preserve one protected request per tool", async (t) => {
  const { api, client } = await fixture(t);
  const tools = (await client.listTools()).tools;
  assert.match(tools.find(tool => tool.name === "query_stats")!.description!, /get_player_prop_evidence/);
  const schema = tools.find(tool => tool.name === "get_player_prop_evidence")!;
  assert.equal(schema.annotations?.readOnlyHint, true);
  assert.ok(Buffer.byteLength(JSON.stringify(schema), "utf8") <= 2500);
  const discovery = await client.callTool({ name: "describe_resource", arguments: { sport: "nhl", resource: "skaters" } });
  assert.match(JSON.stringify(discovery), /skater_shots_on_goal/);
  const screen = await client.callTool({ name: "query_stats", arguments: { sport: "nhl", resource: "skaters", split: "L10",
    metrics: ["sog_per_game", "icf_per_game", "games_played"], sort: "-sog_per_game", day: "today",
    page_size: 12, matchup_market: "shots", matchup_window: "sea" } });
  const evidence = await client.callTool({ name: "get_player_prop_evidence", arguments: request });
  assert.equal(evidence.isError, undefined);
  const reads = api.requests.filter(item => item.authorization !== undefined);
  assert.equal(reads.length, 2);
  assert.match(reads[0]!.path, /matchup_market=shots/);
  assert.deepEqual(JSON.parse(reads[1]!.body!), request);
  assert.equal(reads[1]!.method, "POST");
  assert.ok(Buffer.byteLength(JSON.stringify([screen, evidence]), "utf8") <= 32768);
});

test("invalid prop market names show canonical choices and a working discovery call", async (t) => {
  const { api, client } = await fixture(t);
  const wrong = await client.callTool({ name: "get_player_prop_evidence", arguments: { ...request, market: "sog" } });
  assert.equal(wrong.isError, true);
  const detail = (wrong.structuredContent as { error: { detail: string } }).error.detail;
  assert.match(detail, /describe_resource\(\{ sport: "nhl", resource: "skaters" \}\)/);
  assert.match(detail, /prop_evidence\.markets\[\]\.key/);
  assert.match(detail, /Advertised market keys: skater_shots_on_goal, skater_goals, skater_anytime_goalscorer/);
  assert.equal(api.requests.some(item => item.authorization), false);

  const discovery = await client.callTool({ name: "describe_resource", arguments: { sport: "nhl", resource: "skaters" } });
  assert.equal(discovery.isError, undefined);
  assert.match(JSON.stringify(discovery), /skater_shots_on_goal/);
  const recovered = await client.callTool({ name: "get_player_prop_evidence", arguments: request });
  assert.equal(recovered.isError, undefined);
  const reads = api.requests.filter(item => item.authorization);
  assert.equal(reads.length, 1);
  assert.equal(JSON.parse(reads[0]!.body!).market, "skater_shots_on_goal");
});

test("invalid sort syntax points to the canonical ascending and descending forms", async (t) => {
  const { api, client } = await fixture(t);
  const query = { sport: "nhl", resource: "skaters", metrics: ["sog_per_game"] };
  const wrong = await client.callTool({ name: "query_stats", arguments: { ...query, sort: "sog_per_game:desc" } });
  assert.equal(wrong.isError, true);
  const detail = (wrong.structuredContent as { error: { detail: string } }).error.detail;
  assert.match(detail, /bare discovered metric for ascending/);
  assert.match(detail, /prefix it with - for descending/);
  assert.match(detail, /-sog_per_game/);
  assert.equal(api.requests.some(item => item.authorization), false);

  for (const sort of ["-sog_per_game", "sog_per_game"]) {
    const recovered = await client.callTool({ name: "query_stats", arguments: { ...query, sort } });
    assert.equal(recovered.isError, undefined);
    assert.equal(new URL(api.requests.at(-1)!.path, api.baseUrl).searchParams.get("sort"), sort);
  }
});

for (const mode of ["old", "disabled", "unsafe"]) {
  test(`unavailable ${mode} API makes no protected evidence request`, async (t) => {
    const { api, client } = await fixture(t, mode);
    const result = await client.callTool({ name: "get_player_prop_evidence", arguments: request });
    assert.equal(result.isError, true);
    assert.match(JSON.stringify(result), /prop_evidence_unavailable/);
    assert.equal(api.requests.some(item => item.authorization), false);
  });
}

test("input bounds reject before fetching data and errors never retry", async (t) => {
  const { api, client } = await fixture(t, "busy");
  for (const invalid of [{ ...request, player_ids: Array(6).fill("8478460") }, { ...request, log_limit: 11 },
    { ...request, player_ids: ["8478460", "8478460"] }, { ...request, url: "https://evil.test" }]) {
    assert.equal((await client.callTool({ name: "get_player_prop_evidence", arguments: invalid })).isError, true);
  }
  assert.equal(api.requests.length, 0);
  const result = await client.callTool({ name: "get_player_prop_evidence", arguments: request });
  assert.match(JSON.stringify(result), /stats_api_capacity_exceeded/);
  assert.equal(api.requests.filter(item => item.authorization).length, 1);
});

test("unsupported matchup parameters never reach protected data", async (t) => {
  const { api, client } = await fixture(t, "old");
  const result = await client.callTool({ name: "query_stats", arguments: { sport: "nhl", resource: "skaters", matchup_market: "shots" } });
  assert.equal(result.isError, true);
  assert.equal(api.requests.some(item => item.authorization), false);
});

test("oversized evidence cannot pollute the model context", async (t) => {
  const { client } = await fixture(t, "large");
  const result = await client.callTool({ name: "get_player_prop_evidence", arguments: request });
  assert.match(JSON.stringify(result), /prop_evidence_too_large/);
  assert.ok(Buffer.byteLength(JSON.stringify(result), "utf8") < 1024);
});

test("twelve-player screen and five-player logs/rates/quotes fit the complete context budget", async (t) => {
  const { api, client } = await fixture(t, "busy_slate");
  const tool = (await client.listTools()).tools.find(item => item.name === "query_stats")!;
  assert.match(tool.description!, /prop_screen=true and page_size=12/);
  assert.match(tool.description!, /only sog_per_game, icf_per_game, games_played/);
  const evidenceTool = (await client.listTools()).tools.find(item => item.name === "get_player_prop_evidence")!;
  assert.match(evidenceTool.description!, /keep five log rows and omit include_season unless the user requests/);
  const screen = await client.callTool({ name: "query_stats", arguments: { sport: "nhl", resource: "skaters", split: "L10",
    metrics: ["sog_per_game", "icf_per_game", "games_played"], sort: "-sog_per_game", day: "today",
    page_size: 12, matchup_market: "shots", matchup_window: "sea", prop_screen: true } });
  const evidence = await client.callTool({ name: "get_player_prop_evidence", arguments: {
    ...request, player_ids: Array.from({ length: 5 }, (_, i) => String(8478460 + i)),
  } });
  assert.equal(screen.isError, undefined); assert.equal(evidence.isError, undefined);
  const bytes = Buffer.byteLength(JSON.stringify([screen, evidence]), "utf8");
  assert.ok(bytes <= 32768, String(bytes));
  t.diagnostic(`two_tool_result_bytes=${bytes}`);
  const payload = (screen.structuredContent as { response: { meta: { matchup_basis: { season: string } }; data: Array<{ context: { matchup: { rank: number } } }> } }).response;
  assert.equal(payload.meta.matchup_basis.season, "20262027");
  assert.equal(payload.data[0]!.context.matchup.rank, 4);
  const query = api.requests.find(item => item.path.startsWith("/api/v1/nhl/skaters?"))!;
  assert.equal(new URL(query.path, api.baseUrl).searchParams.has("prop_screen"), false);
});

const packet = { market: "skater_shots_on_goal", player_ids: ["8478460"], side: "under", line: 2.5,
  sections: ["hit_rates", "game_logs", "odds", "matchup", "opponent_recent"] };

test("one evidence call forwards the matchup and opponent-recent sections the server advertises", async (t) => {
  const { api, client } = await fixture(t);
  const tool = (await client.listTools()).tools.find(item => item.name === "get_player_prop_evidence")!;
  assert.match(tool.description!, /matchup \(season opponent rank; side=under gives the under rank\)/);
  assert.match(tool.description!, /opponent_recent/);
  assert.ok(Buffer.byteLength(JSON.stringify(tool), "utf8") <= 2500);
  const result = await client.callTool({ name: "get_player_prop_evidence", arguments: packet });
  assert.equal(result.isError, undefined);
  const reads = api.requests.filter(item => item.authorization !== undefined);
  assert.equal(reads.length, 1);
  assert.deepEqual(JSON.parse(reads[0]!.body!), packet);
});

for (const mode of ["three_sections", "legacy_sections"]) {
  test(`a ${mode} server rejects the new sections before any protected request`, async (t) => {
    const { api, client } = await fixture(t, mode);
    const result = await client.callTool({ name: "get_player_prop_evidence", arguments: packet });
    assert.equal(result.isError, true);
    const detail = (result.structuredContent as { error: { detail: string } }).error.detail;
    assert.match(detail, /does not offer the matchup and opponent_recent sections/);
    assert.match(detail, /hit_rates, game_logs, odds/);
    assert.equal(api.requests.some(item => item.authorization), false);
    const original = await client.callTool({ name: "get_player_prop_evidence", arguments: request });
    assert.equal(original.isError, undefined);
    assert.equal(api.requests.filter(item => item.authorization).length, 1);
  });
}

test("section bounds reject duplicates, unknown names and a sixth entry without a request", async (t) => {
  const { api, client } = await fixture(t);
  for (const sections of [["matchup", "matchup"], ["opponents"], [...packet.sections, "odds"]]) {
    assert.equal((await client.callTool({ name: "get_player_prop_evidence", arguments: { ...packet, sections } })).isError, true);
  }
  assert.equal(api.requests.length, 0);
});
