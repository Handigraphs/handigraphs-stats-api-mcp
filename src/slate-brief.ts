import { z } from "zod";
import { object, type DiscoveryClient } from "./discovery.js";
import { ToolInputError, UpstreamError } from "./errors.js";
import type { StatsApiHttpClient } from "./http.js";

const PATH = "/api/v1/nhl/slate-brief";
export const SLATE_BRIEF_BYTES = 32768;
export const SLATE_BRIEF_DESCRIPTION = "Start broad tonight NHL research here. One bounded read includes all games, contextual odds, starter observations and named injury alerts when v2 is enabled. V2 selects specific offered sides at -250 to +300: at least eight of ten graded skater games or five goalie starts, recent observed rate >= quoted break-even +10pp, season rate >= break-even with at least ten games/five starts. These overlapping samples are descriptive research, not win probabilities or betting value. Flagged out/IR/GTD players and unconfirmed save starters do not qualify. Inspect selection_status and per-market exclusions; do not pad a top five. Follow exact evidence selectors. Date is Eastern today, regular season only; <=12 candidates, <=one/player, complete result <=32 KiB. Legacy servers retain v1; no generation, account writes or bets.";
export const slateBriefSchema = z.object({
  sport: z.literal("nhl"), date: z.iso.date(),
  markets: z.array(z.string().regex(/^[a-z0-9_]{1,80}$/)).min(1).max(10)
    .refine(items => new Set(items).size === items.length, "Markets must be unique.").optional(),
  candidate_limit: z.number().int().min(1).max(12).optional(),
  price_min: z.number().int().min(-100000).max(100000).optional().describe('V2 only. Explicit custom research lower price bound; default -250. Do not loosen automatically to fill a list.'),
  price_max: z.number().int().min(-100000).max(100000).optional().describe('V2 only. Explicit custom research upper price bound; default +300.'),
}).strict();

export async function readSlateBrief(http: StatsApiHttpClient, discovery: DiscoveryClient, input: unknown) {
  const { sport, ...args } = slateBriefSchema.parse(input);
  const descriptor = object((await discovery.get(sport)).slate_brief);
  if (descriptor.enabled !== true || descriptor.contract_version !== 1 || descriptor.method !== "GET"
      || descriptor.path !== PATH) {
    throw new UpstreamError({ status: 503, code: "slate_brief_unavailable",
      detail: "The API does not advertise an enabled compatible slate brief. Use the existing stats/evidence tools and retain coverage limitations." });
  }
  if (args.markets?.some(key => !Array.isArray(descriptor.markets) || !descriptor.markets.includes(key))) {
    throw new ToolInputError("Use market keys from slate_brief.markets in NHL discovery.");
  }
  const url = http.resolve(PATH);
  const v2 = Array.isArray(descriptor.formats) && descriptor.formats.includes('compact_v2');
  if ((args.price_min !== undefined || args.price_max !== undefined) && (!v2 || descriptor.price_controls !== true)) {
    throw new ToolInputError('This API does not advertise v2 price controls. Use the available evidence tools.');
  }
  if ((args.price_min ?? -250) > (args.price_max ?? 300)) throw new ToolInputError('price_min must not exceed price_max.');
  if (v2) url.searchParams.set('format', 'compact_v2');
  for (const [key, value] of Object.entries(args)) {
    if (value !== undefined) url.searchParams.set(key, Array.isArray(value) ? value.join(",") : String(value));
  }
  const response = await http.get(url.href, { protectedData: true });
  if ("notModified" in response || response.json.schema !== (v2 ? "nhl-slate-brief-v2" : "nhl-slate-brief-v1")
      || response.json.slate_date !== args.date || response.json.sport !== sport
      || response.json.game_type !== 2 || !Array.isArray(response.json.games)
      || response.json.games.length > 16 || !Array.isArray(response.json.groups)) {
    throw new UpstreamError({ status: 503, code: "slate_brief_invalid_response",
      detail: "The API returned an incompatible slate brief; retain the request date and report the error." });
  }
  const groups = response.json.groups;
  const count = groups.reduce((total: number, group: unknown) => {
    const candidates = object(group).candidates;
    return total + (Array.isArray(candidates) ? candidates.length : 1000);
  }, 0);
  if (groups.length > 10 || count > (args.candidate_limit ?? 12)
      || object(response.json.coverage).returned !== count) {
    throw new UpstreamError({ status: 503, code: "slate_brief_invalid_response",
      detail: "The API slate brief violates its candidate or coverage bounds." });
  }
  return response.json;
}
