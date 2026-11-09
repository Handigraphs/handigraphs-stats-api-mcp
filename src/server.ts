import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { Config } from "./config.js";
import { DiscoveryClient } from "./discovery.js";
import { ToolInputError, UpstreamError, type SafeProblem } from "./errors.js";
import { StatsApiHttpClient } from "./http.js";
import { FILTER_OPERATORS, validateAndBuildQuery, type QueryInput } from "./query.js";
import { redact, redactCredentialEchoes, safeStderr } from "./redaction.js";
import { registerApiKeySetupTool, type SetupLauncher } from "./setup.js";
import { SERVER_VERSION } from "./version.js";
import { AgentReadClient, agentReadTools } from "./agent-read.js";
import { AgentActionClient, agentActionTools } from "./agent-actions.js";
import { object } from "./discovery.js";
import { compactPropScreen, PROP_MARKET_HELP, propEvidenceSchema, readPropEvidence } from "./prop-evidence.js";
import { GAMECENTER_PAGE_BYTES } from "./gamecenter-compact.js";
import { GAME_ODDS_DESCRIPTION, GAME_ODDS_PAGE_BYTES, GAME_ODDS_PAGE_HELP, gameOddsSchema, readGameOdds } from "./game-odds.js";
import { NHL_AVAILABILITY_PAGE_BYTES, nhlAvailabilityTools, readNhlAvailability } from "./nhl-availability.js";

const sportSchema = z.string().trim().min(1).max(32);
const resourceSchema = z.string().trim().min(1).max(64);

function success(response: Record<string, unknown>, metadata: Record<string, unknown> = {}): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(response) }],
    structuredContent: { response, metadata },
  };
}

function errorResult(problem: SafeProblem, apiKey: string | readonly string[]): CallToolResult {
  const safe = redact(problem, apiKey) as Record<string, unknown>;
  return {
    isError: true,
    content: [{ type: "text", text: JSON.stringify(safe) }],
    structuredContent: { error: safe },
  };
}

function handler(secrets: readonly string[], callback: () => Promise<CallToolResult>): Promise<CallToolResult> {
  return callback().then((result) => redactCredentialEchoes(result, secrets)).catch((error: unknown) => {
    if (error instanceof UpstreamError) return errorResult(error.problem, secrets);
    if (error instanceof ToolInputError) return errorResult({ status: 400, code: error.code, detail: error.message }, secrets);
    safeStderr("Handigraphs Stats API MCP error:", error, secrets);
    return errorResult({ status: 500, code: "mcp_internal_error", detail: "The MCP server could not complete the request." }, secrets);
  });
}

export interface ServerDependencies {
  fetchImpl?: typeof fetch;
  now?: () => number;
  enableLocalSetup?: boolean;
  setupLauncher?: SetupLauncher;
  publicDiscovery?: DiscoveryClient;
  redactionSecrets?: readonly string[];
  signal?: AbortSignal;
  maxToolInputElements?: number;
  enablePropEvidence?: boolean;
}

export function createServer(config: Config, dependencies: ServerDependencies = {}): McpServer {
  const http = new StatsApiHttpClient(config, dependencies.fetchImpl, dependencies.signal);
  const discovery = dependencies.publicDiscovery ?? new DiscoveryClient(http, config.discoveryTtlMs, dependencies.now);
  const secrets = Object.freeze([config.apiKey, ...(dependencies.redactionSecrets ?? [])]);
  const agent = new AgentReadClient(http, discovery, secrets);
  const actions = new AgentActionClient(http, discovery);
  const server = new McpServer({ name: "handigraphs-stats-api", version: SERVER_VERSION },
    dependencies.maxToolInputElements === undefined ? {} : { maxToolInputElements: dependencies.maxToolInputElements });

  server.registerTool("list_resources", {
    title: "List Handigraphs Stats API resources",
    description: "List live sports and stats resources from public Handigraphs discovery.",
    inputSchema: { sport: sportSchema.optional() },
    annotations: { readOnlyHint: true, openWorldHint: true },
  }, ({ sport }) => handler(secrets, async () => {
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
  }, ({ sport, resource }) => handler(secrets, async () => {
    let description: Record<string, unknown>;
    try {
      description = await discovery.describe(sport, resource);
    } catch (error) {
      if (!(error instanceof ToolInputError)) throw error;
      description = await discovery.describe(sport, resource, true);
    }
    if (dependencies.enablePropEvidence && sport === "nhl") {
      const evidence = object((await discovery.get("nhl")).prop_evidence);
      if (evidence.contract_version === 1) description.prop_evidence = evidence;
    }
    return success(description);
  }));

  const filterSchema = z.object({
    metric: z.string().trim().min(1).max(80),
    operator: z.enum(FILTER_OPERATORS),
    value: z.number().finite(),
  }).strict();
  server.registerTool("query_stats", {
    title: "Query Handigraphs stats",
    description: "Query one live Handigraphs Stats API resource. Use describe_resource first; pagination remains in this tool via cursor."
      + (dependencies.enablePropEvidence ? " For tonight's NHL props, screen once with prop_screen=true and page_size=12. For shots on goal use L10 and only sog_per_game, icf_per_game, games_played plus matchup_market=shots, matchup_window=sea; then call get_player_prop_evidence once for up to five players (five logs, no season summary unless requested)." : ""),
    inputSchema: {
      sport: sportSchema,
      resource: resourceSchema,
      split: z.string().trim().min(1).max(80).optional(),
      season: z.string().trim().min(1).max(8).optional()
        .describe("Optional season from live discovery. NHL uses an eight-digit ID such as 20262027; omit to keep the server default."),
      metrics: z.array(z.string().trim().min(1).max(80))
        .min(1)
        .max(100)
        .refine((metrics) => new Set(metrics).size === metrics.length, { message: "metrics must not contain duplicates" })
        .optional(),
      filters: z.array(filterSchema).max(5).optional(),
      sort: z.string().trim().min(1).max(81).optional()
        .describe("Use a bare metric for ascending order or prefix it with - for descending, for example -sog_per_game for NHL skaters."),
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
      matchup_market: z.string().trim().min(1).max(32).optional(),
      matchup_window: z.string().trim().min(1).max(32).optional(),
      ...(dependencies.enablePropEvidence ? { prop_screen: z.boolean().optional()
        .describe("Use true for tonight's NHL prop candidate screen, max 12 rows. Shared opponent rank metadata moves to meta.matchup_basis.") } : {}),
    },
    annotations: { readOnlyHint: true, openWorldHint: true },
  }, (input) => handler(secrets, async () => {
    if (input.prop_screen && (input.sport !== "nhl" || !["skaters", "goalies"].includes(input.resource)
        || (input.stat_format !== undefined && input.stat_format !== "compact")
        || (input.meta !== undefined && input.meta !== "compact") || (input.page_size ?? 12) > 12)) {
      throw new ToolInputError("prop_screen requires NHL skaters/goalies, compact stats/meta and at most 12 rows.");
    }
    if (input.prop_screen && input.page_size === undefined) input.page_size = 12;
    const query = await validateAndBuildQuery(discovery, input as QueryInput);
    const response = await http.get(query.url, { protectedData: true });
    if ("notModified" in response) throw new Error("Protected data unexpectedly returned 304.");
    return success(input.prop_screen ? compactPropScreen(response.json) : response.json, response.metadata);
  }));

  if (dependencies.enablePropEvidence) {
    server.registerTool("get_player_prop_evidence", {
      description: "Read NHL exact-line hit rates and latest ingested sportsbook quotes for up to five players after a query_stats slate screen or a named-player lookup. One market per call. " + PROP_MARKET_HELP + " Request game_logs explicitly, default five and maximum ten per player. For a slate shortlist keep five log rows and omit include_season unless the user requests more history. Defaults to hit_rates and odds, over side, recent ten skater games or five goalie starts. Preserve per-section availability, sample, line and quote timestamp. Observed hit rate is not predicted probability. No saves or research jobs.",
      inputSchema: propEvidenceSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    }, (input) => handler(secrets, async () => {
      const response = await readPropEvidence(http, discovery, input);
      return success(response.json, response.metadata);
    }));
  }

  const tools = [
    ...agentReadTools.map((tool) => ({ ...tool, annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }, execute: (input: unknown) => agent.execute(tool.name, input) })),
    ...agentActionTools.map((tool) => ({ ...tool, execute: (input: unknown) => actions.execute(tool.name, input) })),
  ];
  for (const tool of tools) {
    server.registerTool(tool.name, {
      description: tool.description,
      inputSchema: tool.inputSchema,
      annotations: tool.annotations,
    }, (input: unknown) => handler(secrets, async () => {
      const response = await tool.execute(input);
      // Preserve opaque evaluation/cursor tokens while removing exact credential
      // echoes from arbitrary stored text as well as structured metadata.
      const removeKey = (_key: string, value: unknown) => typeof value === "string" && config.apiKey ? value.split(config.apiKey).join("[REDACTED]") : value;
      const safeResponse = JSON.parse(JSON.stringify(response.json, removeKey)) as Record<string, unknown>;
      const paged = object(input).format === "compact_page";
      if (tool.name === "get_gamecenter_packet" && (paged || object(input).compact === true)) {
        const text = JSON.stringify(safeResponse);
        if (paged && Buffer.byteLength(redactCredentialEchoes(text, secrets), "utf8") > GAMECENTER_PAGE_BYTES) {
          throw new ToolInputError("Gamecenter page exceeds 3.5 KiB. Use compact=true for the full packet.");
        }
        return { content: [{ type: "text", text }] };
      }
      const safeMetadata = JSON.parse(JSON.stringify(response.metadata, removeKey)) as Record<string, unknown>;
      return success(safeResponse, safeMetadata);
    }));
  }

  server.registerTool("get_game_odds", {
    description: GAME_ODDS_DESCRIPTION,
    inputSchema: gameOddsSchema,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, (input) => handler(secrets, async () => {
    const page = await readGameOdds(http, discovery, input);
    const text = redactCredentialEchoes(JSON.stringify(redactCredentialEchoes(page, secrets)), secrets);
    if (Buffer.byteLength(text, "utf8") > GAME_ODDS_PAGE_BYTES) {
      throw new UpstreamError({ status: 413, code: "game_odds_too_large", detail: GAME_ODDS_PAGE_HELP });
    }
    return { content: [{ type: "text", text }] };
  }));

  for (const tool of nhlAvailabilityTools) {
    server.registerTool(tool.name, {
      description: tool.description,
      inputSchema: tool.inputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    }, (input: unknown) => handler(secrets, async () => {
      const page = await readNhlAvailability(http, discovery, tool, input);
      const text = redactCredentialEchoes(JSON.stringify(redactCredentialEchoes(page, secrets)), secrets);
      if (Buffer.byteLength(text, "utf8") > NHL_AVAILABILITY_PAGE_BYTES) {
        throw new UpstreamError({ status: 413, code: `${tool.discoveryKey}_too_large`, detail: tool.sizeHelp });
      }
      return { content: [{ type: "text", text }] };
    }));
  }

  if (dependencies.enableLocalSetup) {
    registerApiKeySetupTool(server, dependencies.setupLauncher);
  }

  return server;
}
