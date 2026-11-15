import { z } from "zod";
import { object, type DiscoveryClient } from "./discovery.js";
import { ToolInputError, UpstreamError } from "./errors.js";
import type { StatsApiHttpClient } from "./http.js";

export const NHL_AVAILABILITY_PAGE_BYTES = 3584;

const date = z.iso.date();
const leagueGameId = z.string().regex(/^[1-9][0-9]{0,9}$/);
const cursor = z.string().min(1).max(2048);

export const nhlAvailabilityTools = [
  {
    name: "get_goalie_status",
    discoveryKey: "goalie_status",
    path: "/api/v1/nhl/goalie-status",
    responseSchema: "nhl-goalie-status-v1",
    items: "games",
    sizeHelp: "Reduce page_size or request one league_game_id.",
    description: "Read stored NHL pregame starter observations for an Eastern date. Frozen Gamecenter projections and latest RotoWire observations have separate clocks. Confirmed means the provider explicitly reported confirmation. Use league_game_id for one game. page_size (1 to 4, default 2) is an upper bound: advertised adaptive pages keep whole games within the byte budget and disclose returned/remaining/byte_limited. Follow next_cursor with the SAME date and requested page_size until null; do not shrink that selector while continuing. An intrinsically oversized game remains an explicit error. No automatic retries.",
    inputSchema: z.object({
      date,
      league_game_id: leagueGameId.optional(),
      page_size: z.number().int().min(1).max(4).optional().describe('Maximum games per page; byte limits may return fewer. Follow next_cursor with this same requested value.'),
      cursor: cursor.optional(),
    }).strict(),
  },
  {
    name: "get_injury_updates",
    discoveryKey: "injury_updates",
    path: "/api/v1/nhl/injury-updates",
    responseSchema: "nhl-injury-updates-v1",
    items: "players",
    sizeHelp: "Reduce page_size or request one side.",
    description: "Read named Daily Faceoff NHL injury flags. With slate discovery support, send date only for all-game coverage and a page of flags ordered by goalie/GTD/key-player importance (page_size 1-100). Follow next_cursor with identical selectors; coverage reports omitted/unavailable data. Use league_game_id for a focused legacy page (1-12) and optional side. These are team-page reports, never game-specific clearance. Stale GTDs remain visible; check source_updated_at, observed_at and coverage. Do not call once per game merely to validate the slate.",
    inputSchema: z.object({
      date,
      league_game_id: leagueGameId.optional(),
      side: z.enum(["away", "home"]).optional(),
      page_size: z.number().int().min(1).max(100).optional(),
      cursor: cursor.optional(),
    }).strict(),
  },
] as const;

export async function readNhlAvailability(
  http: StatsApiHttpClient,
  discovery: DiscoveryClient,
  tool: (typeof nhlAvailabilityTools)[number],
  input: unknown,
) {
  const args = tool.inputSchema.parse(input);
  if (tool.name === "get_goalie_status" && args.league_game_id !== undefined &&
      (args.cursor !== undefined || args.page_size !== undefined)) {
    throw new ToolInputError("Use league_game_id by itself with date, or omit it for slate pagination.");
  }
  const slate = tool.name === 'get_injury_updates' && args.league_game_id === undefined;
  if (tool.name === 'get_injury_updates') {
    const injury = args as { side?: string; page_size?: number };
    if ((slate && injury.side !== undefined) || (!slate && (injury.page_size ?? 8) > 12)) {
      throw new ToolInputError('Slate mode omits side; game-specific injury pages allow at most 12 flags.');
    }
  }
  const descriptor = object((await discovery.get("nhl"))[tool.discoveryKey]);
  if (slate && (object(descriptor.slate).enabled !== true || object(descriptor.slate).schema !== 'nhl-injury-slate-v1')) {
    throw new ToolInputError('This API does not advertise slate injury reads; use one league_game_id for focused legacy evidence.');
  }
  if (descriptor.enabled !== true || descriptor.contract_version !== 1 ||
      descriptor.method !== "GET" || descriptor.path !== tool.path || descriptor.schema !== tool.responseSchema) {
    throw new UpstreamError({
      status: 503, code: `${tool.discoveryKey}_unavailable`,
      detail: `The server must advertise enabled ${tool.discoveryKey} contract 1 in GET /api/v1/nhl. Check the Stats API rollout or ask your operator.`,
    });
  }
  const url = http.resolve(tool.path);
  for (const [key, value] of Object.entries(args)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  const result = await http.get(url.href, { protectedData: true });
  const page = "notModified" in result ? {} : result.json;
  const next = page.next_cursor;
  if (page.schema !== (slate ? 'nhl-injury-slate-v1' : tool.responseSchema) || page.sport !== "nhl" || page.date !== args.date ||
      !Array.isArray(page[tool.items]) || (next !== null && (typeof next !== "string" || !next || next.length > 2048))) {
    throw new UpstreamError({
      status: 503, code: `${tool.discoveryKey}_invalid_response`,
      detail: "The Stats API did not return a compatible NHL availability page.",
    });
  }
  if (tool.name === 'get_goalie_status' && descriptor.adaptive_pages === true) {
    const coverage = object(page.coverage), games = page.games as unknown[];
    const requested = args.league_game_id === undefined ? args.page_size ?? 2 : 1;
    if (coverage.requested_page_size !== requested || coverage.returned !== games.length || games.length > requested
        || ![coverage.offset, coverage.total_games, coverage.remaining].every(n =>
          typeof n === 'number' && Number.isSafeInteger(n) && n >= 0)
        || Number(coverage.offset)+games.length+Number(coverage.remaining) !== coverage.total_games
        || typeof coverage.byte_limited !== 'boolean' || (next !== null) !== (Number(coverage.remaining) > 0)
        || (games.length === 0 && next !== null)) {
      throw new UpstreamError({ status: 503, code: 'goalie_status_invalid_response',
        detail: 'The adaptive goalie page has inconsistent counts or continuation. No retry occurred.' });
    }
  }
  return page;
}
