import { z } from "zod";
import { object, type DiscoveryClient } from "./discovery.js";
import { ToolInputError, UpstreamError } from "./errors.js";
import type { StatsApiHttpClient } from "./http.js";

const PATH = "/api/v1/nhl/slate-brief";
export const SLATE_BRIEF_BYTES = 32768;
export const SLATE_BRIEF_DESCRIPTION = "Start broad tonight NHL research here. When v3 pagination is advertised, defaults are pregame_only=true and first-page context (game odds, goalies and named injury alerts). All eligible player-market selections are retrievable, <=12/page and one/player/page. Follow next_cursor with identical date, markets, candidate_limit, price bounds and pregame_only; omit include_context on continuations (defaults false). Do not repeat market groups to recover size-limited candidates. include_context=false also supports an initial context-light read; pregame_only=false includes the full slate. Snapshots last 180 seconds/eight newer owner snapshots; expiry/cache loss requires an explicit restart. Pages are frozen research, not live availability; quote status_at_read flags started/stale quotes. Each candidate has listed/not_listed/unknown injury-report matching with separate freshness and bounded factual teammate flags, never medical clearance or usage-impact estimates. Relationship IDs label shared game/player/statistical outcomes across pages/requests, not numerical correlation or bookmaker settlement equivalence. Existing v2 price/sample gates remain: -250 to +300, >=8 recent/10 season skater games or 5/5 goalie starts, recent observed rate >= break-even +10pp and season >= break-even. Overlapping observed samples are not forecasts or betting value. Flagged out/IR/GTD and unconfirmed save starters do not qualify at snapshot time. Retain exclusions/warnings; do not pad a top five. Eastern today, regular season only, <=32 KiB complete result. Older APIs retain their unpaged formats. No generation, saves or bets.";
export const slateBriefSchema = z.object({
  sport: z.literal("nhl"), date: z.iso.date(),
  markets: z.array(z.string().regex(/^[a-z0-9_]{1,80}$/)).min(1).max(10)
    .refine(items => new Set(items).size === items.length, "Markets must be unique.").optional(),
  candidate_limit: z.number().int().min(1).max(12).optional(),
  price_min: z.number().int().min(-100000).max(100000).optional().describe('V2 only. Explicit custom research lower price bound; default -250. Do not loosen automatically to fill a list.'),
  price_max: z.number().int().min(-100000).max(100000).optional().describe('V2 only. Explicit custom research upper price bound; default +300.'),
  cursor: z.string().min(1).max(2048).optional().describe('V3 only. Follow next_cursor with unchanged selection controls. No automatic restart after expiry.'),
  include_context: z.boolean().optional().describe('V3 only. Default true on the first page, false on continuations. May change while paging.'),
  pregame_only: z.boolean().optional().describe('V3 only. Default true. False includes all slate game context; snapshot scope stays fixed while paging.'),
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
  const v3 = Array.isArray(descriptor.formats) && descriptor.formats.includes('compact_v3')
    && object(descriptor.pagination).schema === 'nhl-slate-brief-v3';
  if (!v3 && (args.cursor !== undefined || args.include_context !== undefined || args.pregame_only !== undefined)) {
    throw new ToolInputError('This API does not advertise v3 pagination/context controls. Use the available unpaged brief or focused evidence; no selectors were silently ignored.');
  }
  if ((args.price_min !== undefined || args.price_max !== undefined) && ((!v2 && !v3) || descriptor.price_controls !== true)) {
    throw new ToolInputError('This API does not advertise v2 price controls. Use the available evidence tools.');
  }
  if ((args.price_min ?? -250) > (args.price_max ?? 300)) throw new ToolInputError('price_min must not exceed price_max.');
  if (v3 || v2) url.searchParams.set('format', v3 ? 'compact_v3' : 'compact_v2');
  for (const [key, value] of Object.entries(args)) {
    if (value !== undefined) url.searchParams.set(key, Array.isArray(value) ? value.join(",") : String(value));
  }
  const response = await http.get(url.href, { protectedData: true });
  if ("notModified" in response || response.json.schema !== (v3 ? 'nhl-slate-brief-v3' : v2 ? "nhl-slate-brief-v2" : "nhl-slate-brief-v1")
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
  if (v3) {
    const page = response.json;
    const coverage = object(page.coverage);
    const next = page.next_cursor;
    const expectedContext = args.include_context ?? (args.cursor === undefined);
    const numeric = [coverage.eligible, coverage.offset, coverage.remaining];
    const candidates = groups.flatMap((group: unknown) => object(group).candidates as unknown[]);
    const ids = candidates.map((item: unknown) => object(item).candidate_id);
    const players = candidates.map((item: unknown) => object(item).player_id);
    if (page.context_included !== expectedContext || object(page.scope).pregame_only !== (args.pregame_only ?? true)
        || (!expectedContext && (page.games as unknown[]).length !== 0)
        || object(page.snapshot).live_availability_checked !== false
        || !numeric.every(value => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0)
        || Number(coverage.offset) + count + Number(coverage.remaining) !== coverage.eligible
        || (Number(coverage.remaining) > 0 ? typeof next !== 'string' || next.length < 1 || next.length > 2048 : next !== null)
        || (count === 0 && next !== null && !(expectedContext && !args.cursor && coverage.context_only === true))
        || ids.some(id => typeof id !== 'string' || !id) || new Set(ids).size !== count
        || players.some(id => typeof id !== 'string' || !id) || new Set(players).size !== count) {
      throw new UpstreamError({ status: 503, code: 'slate_brief_invalid_response',
        detail: 'The API returned inconsistent pagination, scope or candidate identities. No automatic retry or restart occurred.' });
    }
  }
  return response.json;
}
