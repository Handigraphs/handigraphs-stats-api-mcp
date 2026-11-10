# Handoff: nhl-prop-packet-sections

- **Purpose:** let `get_player_prop_evidence` request the `matchup` and
  `opponent_recent` sections added in REST contract 1.22.0. This is PR-02 of the
  application repository's `plans/nhl_prop_packet/` plan (cjbuskey/handigraphs-app,
  PR-01 merged there as #858 and is live on sandbox).
- **Branch:** `codex/nhl-prop-packet-sections`
- **Base:** `origin/main` at `e6e6834` (#49)
- **Writer / environment:** Claude Code, Windows worktree, 2026-11-10. Writer has stopped.
- **Status:** source and mocked tests only. No release, deployment or live check.

## Changed

- `src/prop-evidence.ts` — five-value section enum, cap of five, and a pre-request
  check against `prop_evidence.sections` from discovery. A server that does not list a
  section (or lists none, as servers before 1.22.0 effectively do) gets a tool input
  error and no protected request.
- `src/server.ts` — tool description names the two sections.
- `docs/player-prop-research.md`,
  `plugins/handigraphs-stats-api-hosted/skills/query-handigraphs-stats/SKILL.md` —
  one-call recipe, side-aware rank reading, and the four-player limit for the largest
  request.
- `tests/prop-evidence.test.ts`, `CHANGELOG.md`.

## Validation

Full `mcp` profile on Windows, Node 22.14: `npm ci`, then `test`, `audit:prod`,
`typecheck`, `build`, `pack:check`, `distributions:check`, `mcpb:check` — all exit 0.

## Not done

- No live sandbox read through the MCP tool (needs a temporary sandbox key).
- No npm, MCPB or plugin release and no hosted deployment. The hosted runtime is pinned
  to its accepted commit, so shipping this to hosted users needs a new owner acceptance.
- The local plugin's copy of the query skill was left unchanged; only the hosted plugin
  documents `get_player_prop_evidence`.
