#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const SANDBOX_BASE_URL = "https://handigraphs-sandbox-web-49829810d1bb.herokuapp.com/api/v1";
const EXPECTED_RESOURCES = {
  mlb: ["batters", "starters", "teams", "bullpens", "relievers"],
  nhl: ["goalies", "skaters", "teams", "teams_by_position"],
};

function record(value, label) {
  assert.ok(value && typeof value === "object" && !Array.isArray(value), `${label} must be an object`);
  return value;
}

function array(value, label) {
  assert.ok(Array.isArray(value), `${label} must be an array`);
  return value;
}

function resourceIds(resources) {
  return resources.map((item) => String(record(item, "resource descriptor").id)).sort();
}

function toolResponse(result, label, apiKey) {
  if (result.isError) {
    const detail = JSON.stringify(result).split(apiKey).join("[REDACTED]");
    throw new Error(`${label} returned an MCP error: ${detail}`);
  }
  const structured = record(result.structuredContent, `${label}.structuredContent`);
  return record(structured.response, `${label}.structuredContent.response`);
}

function validateCompactPayload(payload, sport, resource, availableMetrics) {
  const data = array(payload.data, `${sport}.${resource}.data`);
  const meta = record(payload.meta, `${sport}.${resource}.meta`);
  assert.equal(meta.sport, sport);
  assert.equal(meta.resource, resource);
  assert.equal(meta.stat_format, "compact");
  assert.equal(meta.meta_format, "compact");
  const metricKeys = array(meta.metric_keys, `${sport}.${resource}.meta.metric_keys`).map(String);
  assert.ok(metricKeys.length > 0, `${sport}.${resource} returned no metric keys`);
  for (const metric of metricKeys) {
    assert.ok(Object.hasOwn(availableMetrics, metric), `${sport}.${resource} returned undiscovered metric '${metric}'`);
  }
  const pagination = record(meta.pagination, `${sport}.${resource}.meta.pagination`);
  assert.equal(typeof pagination.has_more, "boolean");
  assert.ok(Number.isInteger(pagination.page_size) && pagination.page_size > 0);
  for (const row of data) {
    const value = record(row, `${sport}.${resource} row`);
    record(value.entity, `${sport}.${resource} row.entity`);
    const stats = record(value.stats, `${sport}.${resource} row.stats`);
    for (const metric of metricKeys) {
      assert.ok(Object.hasOwn(stats, metric), `${sport}.${resource} row omitted '${metric}'`);
      const item = stats[metric];
      assert.ok(item === null || ["number", "string", "boolean"].includes(typeof item), `${sport}.${resource}.${metric} was not compact`);
    }
  }
  return { data, meta, pagination, metricKeys };
}

async function main() {
  const apiKey = process.env.HANDIGRAPHS_API_KEY?.trim() ?? "";
  assert.match(apiKey, /^hg_test_[A-Za-z0-9_-]+$/, "HANDIGRAPHS_API_KEY must be a temporary sandbox hg_test_ key");
  const explicitBaseUrl = process.env.HANDIGRAPHS_API_BASE_URL?.replace(/\/+$/, "");
  assert.ok(!explicitBaseUrl || explicitBaseUrl === SANDBOX_BASE_URL, "live launch audit refuses non-sandbox HANDIGRAPHS_API_BASE_URL");

  const packageManifest = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  const childEnv = Object.fromEntries(Object.entries(process.env).filter((entry) => typeof entry[1] === "string"));
  childEnv.HANDIGRAPHS_API_KEY = apiKey;
  childEnv.HANDIGRAPHS_API_BASE_URL = SANDBOX_BASE_URL;
  childEnv.HANDIGRAPHS_HTTP_TIMEOUT_MS = "30000";
  delete childEnv.HANDIGRAPHS_CODEX_SETUP;

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [resolve("dist/index.js")],
    env: childEnv,
    stderr: "pipe",
  });
  let childStderr = "";
  transport.stderr?.on("data", (chunk) => { childStderr += String(chunk); });
  const client = new Client({ name: "handigraphs-launch-audit", version: "1.0.0" });
  let connected = false;

  try {
    await client.connect(transport);
    connected = true;
    assert.equal(client.getServerVersion()?.version, packageManifest.version, "MCP handshake version does not match package.json");
    assert.deepEqual((await client.listTools()).tools.map((tool) => tool.name), ["list_resources", "describe_resource", "query_stats"]);

    const allResources = toolResponse(
      await client.callTool({ name: "list_resources", arguments: {} }),
      "list_resources(all)",
      apiKey,
    );
    const sports = array(allResources.sports, "list_resources(all).sports");
    assert.deepEqual(sports.map((item) => String(record(item, "sport descriptor").sport)).sort(), Object.keys(EXPECTED_RESOURCES).sort());

    const summaries = [];
    for (const [sport, expected] of Object.entries(EXPECTED_RESOURCES)) {
      const listed = toolResponse(
        await client.callTool({ name: "list_resources", arguments: { sport } }),
        `list_resources(${sport})`,
        apiKey,
      );
      assert.equal(listed.sport, sport);
      assert.deepEqual(resourceIds(array(listed.resources, `${sport}.resources`)), [...expected].sort());

      for (const resource of expected) {
        const description = toolResponse(
          await client.callTool({ name: "describe_resource", arguments: { sport, resource } }),
          `describe_resource(${sport}.${resource})`,
          apiKey,
        );
        assert.equal(description.sport, sport);
        assert.equal(record(description.resource, `${sport}.${resource}.resource`).id, resource);
        const metricsDocument = record(description.metrics, `${sport}.${resource}.metrics`);
        const metricDefinitions = record(metricsDocument.metrics, `${sport}.${resource}.metrics.metrics`);
        const defaultMetrics = array(metricsDocument.default_metrics, `${sport}.${resource}.metrics.default_metrics`).map(String);
        assert.ok(defaultMetrics.length > 0, `${sport}.${resource} has no advertised default metrics`);
        const splitsDocument = record(description.splits, `${sport}.${resource}.splits`);
        assert.ok(array(splitsDocument.splits, `${sport}.${resource}.splits.splits`).length > 0, `${sport}.${resource} has no advertised splits`);

        const result = await client.callTool({ name: "query_stats", arguments: { sport, resource } });
        const response = toolResponse(result, `query_stats(${sport}.${resource})`, apiKey);
        const validated = validateCompactPayload(response, sport, resource, metricDefinitions);
        const metadata = record(result.structuredContent, `${sport}.${resource}.structuredContent`).metadata;
        assert.equal(record(metadata, `${sport}.${resource}.metadata`).status, 200);
        summaries.push({
          sport,
          resource,
          metrics: Object.keys(metricDefinitions).length,
          splits: splitsDocument.splits.length,
          default_metrics: defaultMetrics.length,
          returned_metrics: validated.metricKeys.length,
          rows: validated.data.length,
        });
      }
    }

    let paginationSummary;
    for (const [sport, resources] of Object.entries(EXPECTED_RESOURCES)) {
      for (const resource of resources) {
        const firstResult = await client.callTool({ name: "query_stats", arguments: { sport, resource, page_size: 1 } });
        const firstPayload = toolResponse(firstResult, `pagination(${sport}.${resource}).first`, apiKey);
        const firstMeta = record(firstPayload.meta, `pagination(${sport}.${resource}).first.meta`);
        const firstPage = record(firstMeta.pagination, `pagination(${sport}.${resource}).first.meta.pagination`);
        if (firstPage.has_more !== true || typeof firstPage.next_cursor !== "string") continue;

        const secondResult = await client.callTool({
          name: "query_stats",
          arguments: { sport, resource, page_size: 1, cursor: firstPage.next_cursor },
        });
        const secondPayload = toolResponse(secondResult, `pagination(${sport}.${resource}).second`, apiKey);
        const firstRows = array(firstPayload.data, `pagination(${sport}.${resource}).first.data`);
        const secondRows = array(secondPayload.data, `pagination(${sport}.${resource}).second.data`);
        assert.equal(firstRows.length, 1);
        assert.equal(secondRows.length, 1);
        const firstId = String(record(record(firstRows[0], "first row").entity, "first row.entity").id);
        const secondId = String(record(record(secondRows[0], "second row").entity, "second row.entity").id);
        assert.notEqual(firstId, secondId, "cursor pagination repeated the first entity");
        paginationSummary = { sport, resource, page_size: 1, second_page_verified: true };
        break;
      }
      if (paginationSummary) break;
    }
    assert.ok(paginationSummary, "no sandbox resource produced a cursor for a second page");
    assert.equal(childStderr.includes(apiKey), false, "MCP child stderr exposed the API key");

    process.stdout.write(`${JSON.stringify({
      passed: true,
      timestamp_utc: new Date().toISOString(),
      base_url: SANDBOX_BASE_URL,
      package_version: packageManifest.version,
      server_version: client.getServerVersion()?.version,
      tools: ["list_resources", "describe_resource", "query_stats"],
      resources: summaries,
      pagination: paginationSummary,
      child_stderr_bytes: Buffer.byteLength(childStderr),
      key_redacted: true,
    }, null, 2)}\n`);
  } finally {
    if (connected) await client.close();
  }
}

main().catch((error) => {
  const key = process.env.HANDIGRAPHS_API_KEY?.trim() ?? "";
  const safe = (error instanceof Error ? `${error.name}: ${error.message}` : String(error)).split(key).join("[REDACTED]");
  process.stderr.write(`Stats API MCP sandbox live audit failed: ${safe}\n`);
  process.exitCode = 1;
});
