import { z } from "zod";
import { filterRuleSchema } from "./agent-read.js";
import { DiscoveryClient, object } from "./discovery.js";
import { ToolInputError, UpstreamError } from "./errors.js";
import { StatsApiHttpClient, type JsonResponse, type RequestOptions } from "./http.js";

const id = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const text = (max: number) => z.string().trim().min(1).max(max);
const operationId = z.string().uuid().describe("Generate one UUID per intended create/submission. Retain it and the exact request across ambiguous failures; never generate a new ID merely to retry.");
const date = z.iso.date();
const side = z.enum(["over", "under"]);
const line = z.number().finite().min(0).max(1000);
const minimumSample = z.number().int().min(10).max(200);
const gameType = z.literal(2);

export const researchDefinitionSchema = z.object({
  hypothesis: z.string().max(280).optional(),
  selections: z.array(z.record(z.string(), z.unknown())).max(50).optional(),
  config: filterRuleSchema.extend({
    season: z.union([id, text(8)]), game_type: z.union([gameType, z.literal("2")]).optional(),
    window: z.object({
      preset: z.enum(["custom", "last30", "last60", "last90", "season", "full"]).optional(),
      start_date: date.optional(), end_date: date.optional(),
      custom: z.object({ startDate: date, endDate: date }).strict().optional(),
    }).strict(),
    market: text(100), side, line, min_sample: minimumSample,
    prompt: z.string().max(500).optional(), filter_name: z.string().max(100).optional(), rule_sentence: z.string().max(2000).optional(),
  }).strict(),
}).strict().describe("Saved Angles settings, not a result archive. Include the exact selected native rule, explicit completed dates, season, market, side, line and sample threshold. NHL requires game_type 2.");

const schemas = {
  save_filter: z.object({ operation_id: operationId, name: text(100), rule: filterRuleSchema,
    research_idea: z.object({ name: text(60), definition: researchDefinitionSchema }).strict().optional() }).strict(),
  update_saved_filter: z.object({ filter_id: id, revision: id, name: text(100), rule: filterRuleSchema }).strict(),
  update_saved_research: z.object({ idea_id: z.string().uuid(), revision: id, name: text(60), definition: researchDefinitionSchema }).strict(),
  start_filter_research: z.object({
    operation_id: operationId, rule: filterRuleSchema.optional(), filter_id: id.optional(), revision: id.optional(),
    start_date: date, end_date: date, season: id, phase: z.enum(["regular", "postseason"]).optional(), game_type: gameType.optional(),
    market: text(100), side, line, min_sample: minimumSample,
  }).strict(),
  list_filter_research: z.object({ limit: z.number().int().min(1).max(25).optional() }).strict(),
  get_filter_research: z.object({ job_id: z.string().uuid(), mode: z.enum(["status", "result"]).default("status") }).strict(),
  cancel_filter_research: z.object({ job_id: z.string().uuid() }).strict(),
};
export type AgentActionTool = keyof typeof schemas;
const descriptions: Record<AgentActionTool, string> = {
  save_filter: "Save a new owned filter only when the user explicitly requests a save/create. Optionally save an Angles idea with the identical rule and exact test settings atomically. Required operation_id prevents duplicate creates on retries. Return actual IDs/links and report expiry; never claim a missing paired idea was saved. Requires filters:write; permissions do not replace user intent.",
  update_saved_filter: "Replace an existing owned filter only after explicit user confirmation. Read it first and supply its current revision; conflicting edits fail without overwrite. A tracked filter cannot be replaced: offer a new copy, never create one silently. Does not modify tracking. Requires filters:write.",
  update_saved_research: "Replace an owned Angles idea's name/settings only after explicit user confirmation, using its current revision. Does not change the linked filter or archive an expired report. Reload after a conflict; never silently overwrite. Requires filters:write.",
  start_filter_research: "Submit one bounded historical frequency/outcome job for exactly one native rule or saved filter ID plus revision. Discover capabilities, units, coverage, completed dates, markets and worker readiness first. State comparison settings and attempt budget. Preserve operation_id on ambiguous submission. Never shorten dates, chunk limits or substitute live stats. Returns job ID/polling guidance; does not poll, save a filter or start tracking. Requires research:run.",
  list_filter_research: "Read recent owned API research jobs to resume interrupted work or resolve an ambiguous submission. Does not enqueue work or reset a budget; retain exact request association.",
  get_filter_research: "Read one owned research job's status or result, including frozen inputs, independent frequency/outcome stages, partial failures and report expiry. Respect Retry-After and polling guidance: at least 5 seconds, 15 on unchanged work, stop foreground polling after 10 minutes and retain job ID. Expiry is not an empty result. Does not resubmit or poll automatically.",
  cancel_filter_research: "Request idempotent cancellation of an owned API research job when the user asks to stop it or an agreed research stop condition applies. Return the actual state; cancel_requested is not cancelled. Does not delete completed results or refund an attempt. Requires research:run.",
};
export const agentActionTools = Object.entries(schemas).map(([name, inputSchema]) => {
  const readOnly = name === "list_filter_research" || name === "get_filter_research";
  return { name: name as AgentActionTool, inputSchema, description: descriptions[name as AgentActionTool],
    annotations: { readOnlyHint: readOnly, destructiveHint: name.startsWith("update_") || name === "cancel_filter_research",
      idempotentHint: !name.startsWith("update_"), openWorldHint: true } };
});

const operations = {
  filters_save: { method: "POST", path: "/api/v1/filters" },
  filters_replace: { method: "PUT", path: "/api/v1/filters/{filter_id}" },
  ideas_update: { method: "PUT", path: "/api/v1/research/ideas/{idea_id}" },
  jobs_submit: { method: "POST", path: "/api/v1/research/jobs" },
  jobs_read: { method: "GET", path: "/api/v1/research/jobs" },
  job_read: { method: "GET", path: "/api/v1/research/jobs/{job_id}" },
  job_result: { method: "GET", path: "/api/v1/research/jobs/{job_id}/result" },
  jobs_cancel: { method: "POST", path: "/api/v1/research/jobs/{job_id}/cancel" },
} as const;

function checkDates(start: string, end: string, maxDays?: number): void {
  if (end < start || (maxDays !== undefined && (Date.parse(end) - Date.parse(start)) / 86400000 + 1 > maxDays)) {
    throw new ToolInputError("Use ordered explicit dates within the discovered range and maximum request window. Do not shorten or chunk the request automatically.");
  }
}

function checkDefinition(definition: z.infer<typeof researchDefinitionSchema>): void {
  const { window, table, game_type } = definition.config;
  const start = window.start_date ?? window.custom?.startDate;
  const end = window.end_date ?? window.custom?.endDate;
  if (!start || !end || (window.start_date && window.custom && window.start_date !== window.custom.startDate)
      || (window.end_date && window.custom && window.end_date !== window.custom.endDate)) {
    throw new ToolInputError("Saved ideas require explicit, nonconflicting test dates.");
  }
  checkDates(start, end);
  if (table.startsWith("nhl_") && game_type !== 2 && game_type !== "2") throw new ToolInputError("NHL saved ideas require game_type 2.");
}

export class AgentActionClient {
  constructor(private readonly http: StatsApiHttpClient, private readonly discovery: DiscoveryClient) {}

  private async call(name: keyof typeof operations, options: RequestOptions, params: Record<string, string | number> = {}, query: Record<string, unknown> = {}): Promise<JsonResponse> {
    const descriptor = object(object((await this.discovery.agent()).operations)[name]);
    const expected = operations[name];
    if (descriptor.method !== expected.method || descriptor.path !== expected.path || options.method !== expected.method) {
      throw new UpstreamError({ status: 503, code: "agent_operation_unavailable", detail: "This API server does not advertise a compatible operation. Existing stats tools remain available." });
    }
    let path: string = expected.path;
    for (const [key, value] of Object.entries(params)) path = path.replace(`{${key}}`, encodeURIComponent(String(value)));
    if (/[{}]/.test(path)) throw new ToolInputError("Missing operation selector.");
    const url = this.http.resolve(path);
    for (const [key, value] of Object.entries(query)) if (value !== undefined) url.searchParams.set(key, String(value));
    const response = await this.http.request(url.href, options);
    if ("notModified" in response) throw new Error("Private action unexpectedly returned 304.");
    return { ...response, metadata: { ...response.metadata, ...(response.etag ? { etag: response.etag } : {}) } };
  }

  async execute(name: AgentActionTool, input: unknown): Promise<JsonResponse> {
    switch (name) {
      case "save_filter": {
        const { operation_id, ...body } = schemas[name].parse(input);
        if (body.research_idea) checkDefinition(body.research_idea.definition);
        return this.call("filters_save", { method: "POST", protectedData: true, body, idempotencyKey: operation_id });
      }
      case "update_saved_filter": {
        const { filter_id, revision, ...body } = schemas[name].parse(input);
        return this.call("filters_replace", { method: "PUT", protectedData: true, body, ifMatch: `"${revision}"` }, { filter_id });
      }
      case "update_saved_research": {
        const { idea_id, ...body } = schemas[name].parse(input);
        checkDefinition(body.definition);
        return this.call("ideas_update", { method: "PUT", protectedData: true, body }, { idea_id });
      }
      case "start_filter_research": {
        const { operation_id, ...body } = schemas[name].parse(input);
        if ((body.rule !== undefined) === (body.filter_id !== undefined) || (body.rule && body.revision !== undefined) || (body.filter_id !== undefined && body.revision === undefined)) {
          throw new ToolInputError("Supply exactly one rule or filter_id plus revision.");
        }
        if ((body.phase !== undefined) === (body.game_type !== undefined)
            || (body.rule && body.rule.table.startsWith("nhl_") !== (body.game_type !== undefined))) {
          throw new ToolInputError("Use game_type 2 for NHL, or phase for MLB; never both.");
        }
        checkDates(body.start_date, body.end_date, 366);
        if (Buffer.byteLength(JSON.stringify(body), "utf8") > 32768) throw new ToolInputError("Research request exceeds the 32 KiB limit.");
        return this.call("jobs_submit", { method: "POST", protectedData: true, body, idempotencyKey: operation_id });
      }
      case "list_filter_research": return this.call("jobs_read", { method: "GET", protectedData: true }, {}, schemas[name].parse(input));
      case "get_filter_research": {
        const { job_id, mode } = schemas[name].parse(input);
        return this.call(mode === "result" ? "job_result" : "job_read", { method: "GET", protectedData: true }, { job_id });
      }
      case "cancel_filter_research": return this.call("jobs_cancel", { method: "POST", protectedData: true, body: null }, schemas[name].parse(input));
    }
  }
}
