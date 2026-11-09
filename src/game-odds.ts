import { z } from "zod";
import { object, type DiscoveryClient } from "./discovery.js";
import { ToolInputError, UpstreamError } from "./errors.js";
import type { StatsApiHttpClient } from "./http.js";

const PATH = "/api/v1/nhl/game-odds";
export const GAME_ODDS_PAGE_BYTES = 3584;
export const GAME_ODDS_PAGE_HELP = "Reduce page_size or request one league_game_id.";
export const GAME_ODDS_DESCRIPTION = "Read latest stored NHL pregame moneylines, puck lines and game totals for an Eastern date. Use league_game_id from the odds slate or Gamecenter for one game, or follow next_cursor with the same date and page_size (1 to 4). fetched_at is database ingestion time. A null book means the bookmaker is unknown. Prices can be old or for completed games.";

export const gameOddsSchema = z.object({
  date: z.iso.date(),
  league_game_id: z.string().regex(/^[1-9][0-9]{0,9}$/).optional(),
  page_size: z.number().int().min(1).max(4).optional(),
  cursor: z.string().min(1).max(2048).optional(),
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
  for (const [key, value] of Object.entries(args)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  const result = await http.get(url.href, { protectedData: true });
  if ("notModified" in result || result.json.schema !== "nhl-game-odds-v1" || !Array.isArray(result.json.games)) {
    throw new UpstreamError({ status: 503, code: "game_odds_invalid_response",
      detail: "The Stats API did not return a compatible NHL game odds page." });
  }
  return result.json;
}
