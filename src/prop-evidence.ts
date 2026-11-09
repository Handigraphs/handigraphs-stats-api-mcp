import { z } from "zod";
import { object, type DiscoveryClient } from "./discovery.js";
import { ToolInputError, UpstreamError } from "./errors.js";
import type { StatsApiHttpClient, JsonResponse } from "./http.js";

export const PROP_MARKET_HELP = 'Use prop_evidence.markets[].key from describe_resource({ sport: "nhl", resource: "skaters" }). For example, skater_shots_on_goal.';

export const propEvidenceSchema = z.object({
  market: z.string().trim().min(1).max(80).describe(PROP_MARKET_HELP),
  player_ids: z.array(z.string().regex(/^[1-9][0-9]{0,9}$/)).min(1).max(5)
    .refine((ids) => new Set(ids).size === ids.length, "Player IDs must be unique."),
  line: z.number().finite().min(0).max(1000).optional(),
  side: z.enum(["over", "under", "both"]).optional(),
  sections: z.array(z.enum(["hit_rates", "game_logs", "odds"])).min(1).max(3)
    .refine((items) => new Set(items).size === items.length, "Sections must be unique.").optional(),
  log_limit: z.number().int().min(1).max(10).optional()
    .describe("Default five. Keep five for slate shortlists; use more only when the user requests extended logs."),
  include_season: z.boolean().optional()
    .describe("Omit for tonight's shortlist. Set true only when the user requests a season summary."),
}).strict();

export function compactPropScreen(response: Record<string, unknown>): Record<string, unknown> {
  const rows = Array.isArray(response.data) ? response.data : [];
  const matchups = rows.map(row => object(object(object(row).context).matchup));
  const basisFields = ["market", "window", "season", "game_type", "metric", "league_size", "model_version", "source", "as_of_date", "requested_sample_size"];
  const basis = Object.fromEntries(basisFields.flatMap(key =>
    matchups.length && matchups[0]![key] !== undefined && matchups.every(item => item[key] === matchups[0]![key])
      ? [[key, matchups[0]![key]]] : []));
  const attempts = matchups.map(item => object(item.attempts));
  const attemptBasis = Object.fromEntries(["metric", "source"].flatMap(key =>
    attempts.length && attempts[0]![key] !== undefined && attempts.every(item => item[key] === attempts[0]![key])
      ? [[key, attempts[0]![key]]] : []));
  return { ...response, meta: { ...object(response.meta), matchup_basis: { ...basis, attempts: attemptBasis } },
    data: rows.map((value, index) => {
      const row = object(value), context = object(row.context), matchup = { ...matchups[index] };
      for (const key of Object.keys(basis)) delete matchup[key];
      if (Object.keys(attempts[index]!).length) {
        matchup.attempts = Object.fromEntries(Object.entries(attempts[index]!).filter(([key]) => !(key in attemptBasis)));
      }
      const { matchup_market: _market, matchup_window: _window, ...perPlayer } = context;
      return { ...row, context: { ...perPlayer, ...(Object.keys(matchup).length ? { matchup } : {}) } };
    }),
  };
}

export async function readPropEvidence(http: StatsApiHttpClient, discovery: DiscoveryClient, input: unknown): Promise<JsonResponse> {
  const args = propEvidenceSchema.parse(input);
  const descriptor = object((await discovery.get("nhl")).prop_evidence);
  if (descriptor.contract_version !== 1 || descriptor.method !== "POST"
      || descriptor.path !== "/api/v1/nhl/prop-evidence" || descriptor.enabled !== true) {
    throw new UpstreamError({ status: 503, code: "prop_evidence_unavailable",
      detail: "This API server does not advertise enabled NHL prop evidence. Keep available stats and report the missing capability." });
  }
  const markets = Array.isArray(descriptor.markets) ? descriptor.markets : [];
  if (!markets.some((item) => object(item).key === args.market)) {
    const keys = [...new Set(markets.map((item) => object(item).key).filter(
      (key): key is string => typeof key === "string" && /^[a-z0-9_]{1,80}$/.test(key),
    ))].slice(0, 20);
    const choices = keys.length ? " Advertised market keys: " + keys.join(", ") + "." : "";
    throw new ToolInputError("Unknown NHL prop market. " + PROP_MARKET_HELP + choices);
  }
  const response = await http.request("/api/v1/nhl/prop-evidence", { method: "POST", protectedData: true, body: args });
  if ("notModified" in response) throw new Error("Prop evidence unexpectedly returned 304.");
  if (Buffer.byteLength(JSON.stringify(response.json), "utf8") > 8192) {
    throw new UpstreamError({ status: 413, code: "prop_evidence_too_large", detail: "Request fewer players, sections or game logs." });
  }
  return response;
}
