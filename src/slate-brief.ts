import { z } from "zod";
import { object, type DiscoveryClient } from "./discovery.js";
import { ToolInputError, UpstreamError } from "./errors.js";
import type { StatsApiHttpClient } from "./http.js";

const PATH = "/api/v1/nhl/slate-brief";
export const SLATE_BRIEF_BYTES = 32768;
export const SLATE_BRIEF_DESCRIPTION = "Start broad tonight NHL research here when enabled by live discovery. One bounded read returns the complete game list, game odds as context, starter observations and up to 12 offered exact-line statistical candidates grouped by market. Use an explicit Eastern date; today and regular season only. Five graded observations required; saves require a fresh confirmed starter. Samples and matchup ranks order candidates, not predicted value. Return fewer picks when coverage is insufficient. Follow exact evidence selectors for detail. No generation, saves, research jobs or bets.";
export const slateBriefSchema = z.object({
  sport: z.literal("nhl"), date: z.iso.date(),
  markets: z.array(z.string().regex(/^[a-z0-9_]{1,80}$/)).min(1).max(10)
    .refine(items => new Set(items).size === items.length, "Markets must be unique.").optional(),
  candidate_limit: z.number().int().min(1).max(12).optional(),
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
  for (const [key, value] of Object.entries(args)) {
    if (value !== undefined) url.searchParams.set(key, Array.isArray(value) ? value.join(",") : String(value));
  }
  const response = await http.get(url.href, { protectedData: true });
  if ("notModified" in response || response.json.schema !== "nhl-slate-brief-v1"
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
