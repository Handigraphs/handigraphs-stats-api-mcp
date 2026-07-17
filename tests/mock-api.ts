import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { once } from "node:events";

export interface MockApi {
  baseUrl: string;
  requests: Array<{ path: string; authorization?: string; ifNoneMatch?: string }>;
  close(): Promise<void>;
}

export async function startMockApi(custom?: (request: IncomingMessage, response: ServerResponse) => boolean): Promise<MockApi> {
  const requests: MockApi["requests"] = [];
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    requests.push({
      path: `${url.pathname}${url.search}`,
      ...(request.headers.authorization ? { authorization: request.headers.authorization } : {}),
      ...(request.headers["if-none-match"] ? { ifNoneMatch: String(request.headers["if-none-match"]) } : {}),
    });
    if (custom?.(request, response)) return;
    const send = (body: unknown, headers: Record<string, string> = {}) => {
      response.writeHead(200, { "content-type": "application/json", ...headers });
      response.end(JSON.stringify(body));
    };
    if (url.pathname === "/api/v1") return send({ api_version: "v1", sports: [{ id: "mlb", href: "/api/v1/mlb" }] }, { etag: '"root-v1"' });
    if (url.pathname === "/api/v1/mlb") return send({ api_version: "v1", sport: "mlb", resources: [{
      id: "batters", href: "/api/v1/mlb/batters", metrics: "/api/v1/mlb/metrics?resource=batters",
      splits: "/api/v1/mlb/splits?resource=batters", filters: ["split", "team", "opponent", "entity_id", "metrics", "filter", "sort", "meta", "stat_format", "page_size", "cursor", "day"],
    }, {
      id: "teams_by_position", href: "/api/v1/mlb/teams/by-position", metrics: "/api/v1/mlb/metrics?resource=teams_by_position",
      splits: "/api/v1/mlb/splits?resource=teams_by_position", filters: ["split", "metrics", "filter", "sort", "meta", "stat_format", "page_size", "cursor", "category", "duration", "location"],
    }] });
    if (url.pathname === "/api/v1/mlb/metrics") return send({ api_version: "v1", sport: "mlb", resource: "batters", metrics: {
      avg: { scale: "0_to_1", unit: "proportion" }, home_runs: { scale: "integer", unit: "count" },
    } }, { etag: '"metrics-v1"' });
    if (url.pathname === "/api/v1/mlb/splits") return send({ api_version: "v1", sport: "mlb", resource: url.searchParams.get("resource"), default: "season", splits: [{ id: "season" }, { id: "last10" }], ...(url.searchParams.get("resource") === "teams_by_position" ? { filters: { category: ["SOG", "GA"], duration: ["ytd", "recent10"], location: ["all", "home", "away"] } } : {}) });
    if (url.pathname === "/api/v1/mlb/batters") {
      return send({ data: [{ entity: { id: "1", name: "Player" }, stats: { avg: 0.2 } }], meta: { pagination: { next_cursor: null } } }, {
        "x-request-id": "req-123", "x-ratelimit-limit-minute": "60", "x-ratelimit-remaining-minute": "59",
        "x-ratelimit-limit-day": "5000", "x-ratelimit-remaining-day": "4999", "x-stats-api-cache": "miss",
      });
    }
    if (url.pathname === "/api/v1/mlb/teams/by-position") return send({ data: [], meta: { pagination: { next_cursor: null } } });
    response.writeHead(404, { "content-type": "application/problem+json" });
    response.end(JSON.stringify({ code: "not_found", detail: "Not found" }));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Mock server did not bind.");
  return {
    baseUrl: `http://127.0.0.1:${address.port}/api/v1`, requests,
    close: async () => { server.close(); await once(server, "close"); },
  };
}
