import { z } from "zod";
import { object, type DiscoveryClient } from "./discovery.js";
import { ToolInputError, UpstreamError } from "./errors.js";
import type { StatsApiHttpClient } from "./http.js";

const PATH = "/api/v1/nhl/slate-brief";
export const SLATE_BRIEF_BYTES = 32768;
export const SLATE_BRIEF_DESCRIPTION = "Start broad tonight NHL research here. For a top N request use advertised v4 view=shortlist and candidate_limit=N: the complete covered eligible player-market pool is ranked by season observed hit rate minus quoted break-even, with one market per player globally. This historical screening order is not probability, EV or a betting-value model. Shortlist defaults to context-light; shared team_contexts are always included for its ordered flat candidates. view=research retains round-robin market browsing and all alternatives. Research first pages default to game/goalie/injury context, continuations omit it. Follow next_cursor with identical date, view, markets, limit, prices and pregame_only; never claim a partial research pool is the global top N. Snapshots expire180s/eight newer snapshots; no automatic restart. Injury matched_known_entry is separate from overall listed/not_listed/unknown and unresolved report identities: never medical clearance. Read shared reported_players as team facts, excluding the candidate itself for teammate interpretation; no usage effects. Relationship IDs do not certify correlation or bookmaker settlement equivalence. Preserve source/quote clocks, started/stale status and coverage warnings. Existing price/sample gates remain -250 to +300, 8 recent/10 season skater games or 5/5 goalie starts, recent observed rate >= break-even +10pp, season >= break-even. Overlapping samples are not forecasts. Out/IR/GTD and unconfirmed save starters do not qualify. Do not pad a top five. Older APIs retain v3 paging and v2/legacy representations; explicit unsupported view is rejected. Eastern today/regular season only, <=12/page and <=32KiB complete result. No generation, saves or bets.";
export const slateBriefSchema = z.object({
  sport: z.literal("nhl"), date: z.iso.date(),
  markets: z.array(z.string().regex(/^[a-z0-9_]{1,80}$/)).min(1).max(10)
    .refine(items => new Set(items).size === items.length, "Markets must be unique.").optional(),
  candidate_limit: z.number().int().min(1).max(12).optional(),
  view: z.enum(['research', 'shortlist']).optional().describe('V4 only. Use shortlist for top N from the complete eligible pool; season-gap order and one market/player globally. Defaults research.'),
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
  const v4 = Array.isArray(descriptor.formats) && descriptor.formats.includes('compact_v4')
    && object(descriptor.shortlist).schema === 'nhl-slate-brief-v4'
    && Array.isArray(object(descriptor.shortlist).views)
    && ['research', 'shortlist'].every(view => (object(descriptor.shortlist).views as unknown[]).includes(view));
  if (!v4 && args.view !== undefined) throw new ToolInputError('This API does not advertise v4 ranked views. Explicit view was not ignored; use supported research tools and disclose partial coverage.');
  if (!v4 && !v3 && (args.cursor !== undefined || args.include_context !== undefined || args.pregame_only !== undefined)) {
    throw new ToolInputError('This API does not advertise v3 pagination/context controls. Use the available unpaged brief or focused evidence; no selectors were silently ignored.');
  }
  if ((args.price_min !== undefined || args.price_max !== undefined) && ((!v2 && !v3 && !v4) || descriptor.price_controls !== true)) {
    throw new ToolInputError('This API does not advertise v2 price controls. Use the available evidence tools.');
  }
  if ((args.price_min ?? -250) > (args.price_max ?? 300)) throw new ToolInputError('price_min must not exceed price_max.');
  if (v4 || v3 || v2) url.searchParams.set('format', v4 ? 'compact_v4' : v3 ? 'compact_v3' : 'compact_v2');
  for (const [key, value] of Object.entries(args)) {
    if (value !== undefined) url.searchParams.set(key, Array.isArray(value) ? value.join(",") : String(value));
  }
  const response = await http.get(url.href, { protectedData: true });
  if ("notModified" in response || response.json.schema !== (v4 ? 'nhl-slate-brief-v4' : v3 ? 'nhl-slate-brief-v3' : v2 ? "nhl-slate-brief-v2" : "nhl-slate-brief-v1")
      || response.json.slate_date !== args.date || response.json.sport !== sport
      || response.json.game_type !== 2 || !Array.isArray(response.json.games)
      || response.json.games.length > 16 || !Array.isArray(response.json.groups)) {
    throw new UpstreamError({ status: 503, code: "slate_brief_invalid_response",
      detail: "The API returned an incompatible slate brief; retain the request date and report the error." });
  }
  const groups = response.json.groups;
  const count = v4 ? (Array.isArray(response.json.candidates) ? response.json.candidates.length : 1000) : groups.reduce((total: number, group: unknown) => {
    const candidates = object(group).candidates;
    return total + (Array.isArray(candidates) ? candidates.length : 1000);
  }, 0);
  if (groups.length > 10 || count > (args.candidate_limit ?? 12)
      || object(response.json.coverage).returned !== count) {
    throw new UpstreamError({ status: 503, code: "slate_brief_invalid_response",
      detail: "The API slate brief violates its candidate or coverage bounds." });
  }
  if (v4 || v3) {
    const page = response.json;
    const coverage = object(page.coverage);
    const next = page.next_cursor;
    const expectedContext = args.include_context ?? (args.cursor === undefined && (!v4 || args.view !== 'shortlist'));
    const numeric = [coverage.eligible, coverage.offset, coverage.remaining];
    const candidates = v4 ? page.candidates as unknown[] : groups.flatMap((group: unknown) => object(group).candidates as unknown[]);
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
    if (v4) {
      const contexts = object(page.team_contexts), ranking = object(page.ranking);
      const view = args.view ?? 'research';
      const sum = (key: string) => groups.reduce((total: number, group: unknown) => {
        const n = object(group)[key];
        return total + (typeof n === 'number' && Number.isSafeInteger(n) && n >= 0 ? n : 1000000);
      }, 0);
      if (page.view !== view || sum('eligible') !== coverage.eligible || sum('returned') !== count
          || sum('remaining') !== coverage.remaining || sum('pool_eligible') !== coverage.eligible_player_markets
          || ranking.candidate_pool_count !== coverage.eligible_player_markets
          || candidates.some((candidate: unknown, index: number) => {
            const item = object(candidate), ref = item.team_context_ref;
            const context = typeof ref === 'string' && Object.hasOwn(contexts, ref) ? object(contexts[ref]) : {};
            return context.league_game_id !== item.league_game_id || context.team !== item.team
              || !groups.some((group: unknown) => object(group).market === item.market)
              || (view === 'shortlist' && item.rank !== Number(coverage.offset)+index+1);
          })
          || (view === 'shortlist' && (ranking.basis !== 'season_minus_break_even_pp'
            || ranking.one_market_per_player !== true || ranking.unique_player_count !== coverage.eligible))) {
        throw new UpstreamError({ status: 503, code: 'slate_brief_invalid_response',
          detail: 'The ranked pool, global ranks or page-local team references are inconsistent.' });
      }
    }
  }
  return response.json;
}
