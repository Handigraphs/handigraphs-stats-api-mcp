import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { Config } from "./config.js";
import { DiscoveryClient } from "./discovery.js";
import { ToolInputError, UpstreamError, type SafeProblem } from "./errors.js";
import { StatsApiHttpClient } from "./http.js";
import { FILTER_OPERATORS, validateAndBuildQuery, type QueryInput } from "./query.js";
import { redact, safeStderr } from "./redaction.js";

const sportSchema = z.string().trim().min(1).max(32);
const resourceSchema = z.string().trim().min(1).max(64);

function success(response: Record<string, unknown>, metadata: Record<string, unknown> = {}): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(response) }],
    structuredContent: { response, metadata },
  };
}

function errorResult(problem: SafeProblem, apiKey: string): CallToolResult {
  const safe = redact(problem, apiKey) as Record<string, unknown>;
  return {
    isError: true,
    content: [{ type: "text", text: JSON.stringify(safe) }],
    structuredContent: { error: safe },
  };
}

function handler(config: Config, callback: () => Promise<CallToolResult>): Promise<CallToolResult> {
  return callback().catch((error: unknown) => {
    if (error instanceof UpstreamError) return errorResult(error.problem, config.apiKey);
    if (error instanceof ToolInputError) return errorResult({ status: 400, code: error.code, detail: error.message }, config.apiKey);
    safeStderr("Handigraphs Stats API MCP error:", error, config.apiKey);
    return errorResult({ status: 500, code: "mcp_internal_error", detail: "The MCP server could not complete the request." }, config.apiKey);
  });
}

export interface ServerDependencies {
  fetchImpl?: typeof fetch;
  now?: () => number;
}

export function createServer(config: Config, dependencies: ServerDependencies = {}): McpServer {
  const http = new StatsApiHttpClient(config, dependencies.fetchImpl);
  const discovery = new DiscoveryClient(http, config.discoveryTtlMs, dependencies.now);
  const server = new McpServer({ name: "handigraphs-stats-api", version: "0.2.0" });

  server.registerTool("list_resources", {
    title: "List Handigraphs Stats API resources",
    description: "List live sports and stats resources from public Handigraphs discovery.",
    inputSchema: { sport: sportSchema.optional() },
    annotations: { readOnlyHint: true, openWorldHint: true },
  }, ({ sport }) => handler(config, async () => {
    if (sport) {
      try { return success({ sport, resources: await discovery.resources(sport) }); }
      catch (error) {
        if (!(error instanceof ToolInputError)) throw error;
        return success({ sport, resources: await discovery.resources(sport, true) });
      }
    }
    const sports = await discovery.sports();
    const resources = await Promise.all(sports.map(async (id) => ({ sport: id, resources: await discovery.resources(id) })));
    return success({ sports: resources });
  }));

  server.registerTool("describe_resource", {
    title: "Describe a Handigraphs Stats API resource",
    description: "Return live resource, metric, split, unit, and filter discovery.",
    inputSchema: { sport: sportSchema, resource: resourceSchema },
    annotations: { readOnlyHint: true, openWorldHint: true },
  }, ({ sport, resource }) => handler(config, async () => {
    try { return success(await discovery.describe(sport, resource)); }
    catch (error) {
      if (!(error instanceof ToolInputError)) throw error;
      return success(await discovery.describe(sport, resource, true));
    }
  }));

  const filterSchema = z.object({
    metric: z.string().trim().min(1).max(80),
    operator: z.enum(FILTER_OPERATORS),
    value: z.number().finite(),
  }).strict();
  server.registerTool("query_stats", {
    title: "Query Handigraphs stats",
    description: "Query one live Handigraphs Stats API resource. Use describe_resource first; pagination remains in this tool via cursor.",
    inputSchema: {
      sport: sportSchema,
      resource: resourceSchema,
      split: z.string().trim().min(1).max(80).optional(),
      metrics: z.array(z.string().trim().min(1).max(80))
        .min(1)
        .max(100)
        .refine((metrics) => new Set(metrics).size === metrics.length, { message: "metrics must not contain duplicates" })
        .optional(),
      filters: z.array(filterSchema).max(5).optional(),
      sort: z.string().trim().min(1).max(81).optional(),
      team: z.string().trim().min(1).max(20).optional(),
      opponent: z.string().trim().min(1).max(20).optional(),
      entity_id: z.string().trim().min(1).max(100).optional(),
      day: z.string().trim().min(1).max(32).optional(),
      page_size: z.number().int().min(1).max(250).optional(),
      cursor: z.string().trim().min(1).max(4096).optional(),
      stat_format: z.enum(["standard", "compact", "rich"]).optional(),
      meta: z.enum(["compact", "full"]).optional(),
      category: z.string().trim().min(1).max(40).optional(),
      duration: z.string().trim().min(1).max(40).optional(),
      location: z.string().trim().min(1).max(40).optional(),
    },
    annotations: { readOnlyHint: true, openWorldHint: true },
  }, (input) => handler(config, async () => {
    const query = await validateAndBuildQuery(discovery, input as QueryInput);
    const response = await http.get(query.url, { protectedData: true });
    if ("notModified" in response) throw new Error("Protected data unexpectedly returned 304.");
    return success(response.json, response.metadata);
  }));

  return server;
}
