# NHL Prop Packet Sections Acceptance (November 14, 2026)

This record covers sandbox verification for `nhl-prop-packet-sections` (MCP PR `#50`, built alongside PR `#51`) and Stats API contract `1.22.0` (`cjbuskey/handigraphs-app` PR `#858`) on November 14, 2026.

## Pinned Revisions

| Surface | Commit | Notes |
| --- | --- | --- |
| Stats API (`handigraphs-sandbox-web`) | `9fdaa673c62bd97e1d53c9f9be7c480f83b27895` | Sandbox web `v1439`; `STATS_API_PROP_EVIDENCE_ENABLED=true` set temporarily during verification, then restored to unset |
| Stats API (`handigraphs` production) | `b289e5350072fb37f68ca22fa5d937d78569343d` | Prod web `v649`; already serves contract `1.22.0` with `STATS_API_PROP_EVIDENCE_ENABLED="true"` |
| Hosted MCP (`handigraphs-mcp-sandbox`) | `450f6da41868e5d610c0b599b9f3d31dede01749` | Sandbox MCP `v14` ([run 43609945396](https://github.com/Handigraphs/handigraphs-stats-api-mcp/actions/runs/43609945396)) |

## Sandbox Verification

Hosted Claude browser OAuth replay was not run. Verification instead exercised:

1. **Hosted sandbox service readiness (`handigraphs-mcp-sandbox` `v14`, SHA `450f6da4`):**
   - `GET https://mcp-sandbox.handigraphs.com/health/ready` -> `200` `{"ready":true,"stateless":true,"version":"0.3.0"}`
   - `GET https://mcp-sandbox.handigraphs.com/health/live` -> `200` `{"live":true}`
   - `POST https://mcp-sandbox.handigraphs.com/mcp` (unauthenticated) -> `401 Unauthorized`

2. **Hosted-config MCP server (`450f6da4`) against live `handigraphs-sandbox-web` (`9fdaa673`):**
   - Invoked `createServer(loadConfig(process.env), { enablePropEvidence: true })` against `handigraphs-sandbox-web` with a disposable synthetic `agent_acceptance` user (`id=2476`, deleted after cleanup) and temporary `STATS_API_PROP_EVIDENCE_ENABLED=true` (restored to unset after verification; `STATS_API_BETA_USER_IDS` and `STATS_API_AGENT_BETA_USER_IDS` preserved).
   - Tool discovery registered 23 tools (`HAS_PROP_EVIDENCE: true`), and `describe_resource` returned `prop_evidence.sections = ["hit_rates", "game_logs", "odds", "matchup", "opponent_recent"]`.
   - `get_player_prop_evidence` on `["8483445", "8477934"]` (`Cutter Gauthier`, `Leon Draisaitl`, `market: "skater_shots_on_goal"`, `line: 2.5`, `sections: ["hit_rates", "odds", "matchup", "opponent_recent"]`) returned `over` (2,051 bytes), `under` (2,056 bytes), and `both` (3,010 bytes).

3. **Dashboard & PostgreSQL Parity (`slate_date: "2026-11-14"`):**
   - `matchup` section matched `services.nhl_matchup.attach_matchups(..., dashboard=True)` on sandbox PostgreSQL:
     - `8483445` (`Cutter Gauthier`, ANA vs `NYI`): `rank: 9`, `tier: "favorable"`, `under_rank: 24`, `under_tier: "difficult"`, `sample_size: 18`, `value: 28.88888888888889`.
     - `8477934` (`Leon Draisaitl`, EDM vs `TOR`): `rank: 7`, `tier: "favorable"`, `under_rank: 26`, `under_tier: "difficult"`, `sample_size: 21`, `value: 29.238095238095237`.
   - `opponent_recent` matched live `POST /api/hit-rates/nhl-opponent-recent`: both returned `status: "unavailable"`, `reason: "no_regular_season_matchup"`, `games_used: 0` on `2026-11-14` because sandbox `nhl_data.skater_lines_daily` stops at `2026-11-13`.

4. **Byte-Cap Matrix (`["8483445", "8477934", "8480801", "8481559"]`, `line: 2.5`, `side: "both"`, `include_season: true`):**
   - 4 players, 4 sections (`hit_rates`, `odds`, `matchup`, `opponent_recent`): `6,035` bytes (`200`).
   - 3 players, all 5 sections: `6,587` bytes (`200`).
   - 4 players, all 5 sections: `413 prop_evidence_too_large` (exceeded 8,192-byte cap).

## Production Rollout

`handigraphs` production web (`v649`) already runs contract `1.22.0` with `STATS_API_PROP_EVIDENCE_ENABLED="true"`. Once `cjbuskey` approves and merges this acceptance PR into `main`, dispatch `Deploy Hosted MCP (Production)` (`deploy-mcp-prod.yml`) with:

- `mcp_sha`: the full merged `main` commit SHA
- `app_sha`: `9fdaa673c62bd97e1d53c9f9be7c480f83b27895`
- `confirm`: `deploy-production`

Then approve the `production` GitHub environment gate.
