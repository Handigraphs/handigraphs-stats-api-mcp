import { z } from "zod";
import { object, type DiscoveryClient } from "./discovery.js";
import { ToolInputError, UpstreamError } from "./errors.js";
import type { StatsApiHttpClient } from "./http.js";

const PATH = "/api/v1/nhl/game-odds";
export const GAME_ODDS_PAGE_BYTES = 3584;
export const GAME_ODDS_PAGE_HELP = "Reduce page_size or request one league_game_id.";
export const GAME_ODDS_DESCRIPTION = "Read stored NHL pregame moneylines, puck lines and totals for an Eastern date. The slate brief already includes game odds; use this for exact game follow-up. Use league_game_id or follow next_cursor with the same date and page_size (1 to 4). include_price_math=true adds break-even and normalized same-book paired prices when supported (16 KiB complete tool limit). These are price arithmetic, not forecasts. fetched_at is ingestion time; null book is unknown. Stored prices for started/completed games are historical context.";

export const gameOddsSchema = z.object({
  date: z.iso.date(),
  league_game_id: z.string().regex(/^[1-9][0-9]{0,9}$/).optional(),
  page_size: z.number().int().min(1).max(4).optional(),
  cursor: z.string().min(1).max(2048).optional(),
  include_price_math: z.boolean().optional(),
}).strict();

export async function readGameOdds(http: StatsApiHttpClient, discovery: DiscoveryClient, input: unknown) {
  const args = gameOddsSchema.parse(input);
  if (args.league_game_id !== undefined && (args.cursor !== undefined || args.page_size !== undefined)) {
    throw new ToolInputError("Use league_game_id by itself with date, or omit it for slate pagination.");
  }
  const descriptor = object((await discovery.get("nhl")).game_odds);
  if (descriptor.enabled !== true || descriptor.contract_version !== 1 ||
      descriptor.method !== "GET" || descriptor.path !== PATH) {
    throw new UpstreamError({ status: 503, code: "game_odds_unavailable",
      detail: "The server must advertise enabled game_odds contract 1 in GET /api/v1/nhl. Check the Stats API rollout or ask your operator." });
  }
  const url = http.resolve(PATH);
  if (args.include_price_math === true && object(descriptor.price_math).parameter !== "include_price_math") {
    throw new ToolInputError("This server does not advertise price arithmetic. Read stored odds without include_price_math.");
  }
  for (const [key, value] of Object.entries(args)) {
    if (key === 'include_price_math' && object(descriptor.price_math).parameter !== 'include_price_math') continue;
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  const result = await http.get(url.href, { protectedData: true });
  if ("notModified" in result || result.json.schema !== "nhl-game-odds-v1" || !Array.isArray(result.json.games)) {
    throw new UpstreamError({ status: 503, code: "game_odds_invalid_response",
      detail: "The Stats API did not return a compatible NHL game odds page." });
  }
  return result.json;
}
