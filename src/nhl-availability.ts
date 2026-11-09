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
    description: "Read stored NHL pregame starter observations for an Eastern date. The frozen Gamecenter projection and latest RotoWire observation are separate. Confirmed means RotoWire explicitly reported confirmation. Use league_game_id for one game or follow next_cursor with the same date and page_size (1 to 4) for a slate.",
    inputSchema: z.object({
      date,
      league_game_id: leagueGameId.optional(),
      page_size: z.number().int().min(1).max(4).optional(),
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
    description: "Read stored Daily Faceoff NHL team injury reports for an Eastern date and league_game_id. These are team-page flags, not game-specific availability. Check source_updated_at, source freshness and coverage. A null report is unavailable. Follow next_cursor with the same selectors, including optional side and page_size (1 to 12).",
    inputSchema: z.object({
      date,
      league_game_id: leagueGameId,
      side: z.enum(["away", "home"]).optional(),
      page_size: z.number().int().min(1).max(12).optional(),
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
  const descriptor = object((await discovery.get("nhl"))[tool.discoveryKey]);
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
  if (page.schema !== tool.responseSchema || page.sport !== "nhl" || page.date !== args.date ||
      !Array.isArray(page[tool.items]) || (next !== null && (typeof next !== "string" || !next || next.length > 2048))) {
    throw new UpstreamError({
      status: 503, code: `${tool.discoveryKey}_invalid_response`,
      detail: "The Stats API did not return a compatible NHL availability page.",
    });
  }
  return page;
}
