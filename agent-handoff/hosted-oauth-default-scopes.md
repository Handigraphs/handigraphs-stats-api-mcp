# Hosted OAuth default-scope wording

- Branch: `codex/hosted-oauth-default-scopes-wording`.
- Base: freshly cloned `origin/main` `a2909a6e84d8b4ea5b30162f2999eeca0ef5a8ef`
  (the frozen hosted acceptance MCP SHA). No open PRs at task start.
- Writer: Claude Code side session, Windows desktop, dedicated fresh clone. The
  pinned acceptance reference clone was not touched.
- Status: docs/skill/check wording only. **Merge freeze:** keep as a Draft PR; do
  not mark ready or merge until the owner lifts the hosted MCP acceptance freeze
  (any merge invalidates the frozen app 3dd38c34 / MCP a2909a6e pair). No release,
  tag, publication or deployment.

## Decision

Owner decision 2026-10-23: every agentic client connecting through hosted OAuth
gets the default access `stats:read` + `filters:write` + `research:run`. The
consent page shows each scope as a separate, pre-ticked choice; owners can untick
`filters:write` or `research:run`, or revoke later. The app-side acceptance
harness was aligned separately (app branch commit d4b14ef8).

## Changes

- Hosted skills (`query-handigraphs-stats`, `research-handigraphs-filters`):
  replaced "independent opt-in consent choices" with the default-access wording.
  The shared business workflow section is unchanged, so local/hosted parity holds.
- `docs/codex-setup.md`: sandbox sign-in step and the reconnect section.
- `README.md` hosted row, `CHANGELOG.md` unreleased entry, and an `AGENTS.md`
  note superseding the copied plan / PR-08 progress opt-in wording.
- `scripts/check-distributions.mjs` and `tests/hosted-distributions.test.ts` now
  assert the new wording; the test also rejects the old opt-in phrasing.
- Unchanged by design: `src/` (already accepts and advertises all three scopes),
  hosted `.mcp.json`/`mcp.claude.json`/plugin manifests (no scope pins), MCPB
  (local stdio only), API-key wording (already default-on), and historical
  `plans/` and `agent-handoff/` text.

## Validation

Full `mcp` profile results are recorded in the PR body.
