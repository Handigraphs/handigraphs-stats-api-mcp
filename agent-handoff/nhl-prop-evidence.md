# Hosted NHL prop research

Active writer is Codex in the Windows desktop session on 2026-11-07.
Branch is `codex/nhl-prop-evidence`, based on verified origin/main at
`748d2cab3598a6d07df53189ad5794257ad75a23`.
The code checkpoint is this commit.

This implements the gateway portion of the approved NHL prop research plan.
Hosted HTTP adds `get_player_prop_evidence` using one protected backend POST,
discovered contract version 1, a fixed same-origin path, at most five IDs and an
independent 8 KiB upstream result check. Unsupported/disabled/old API descriptors
return safe unavailable errors. The shared stats tool now forwards discovered
matchup selectors. Existing stdio business tools remain available.

An opt-in hosted `prop_screen=true` representation caps the screen at 12 rows and
moves identical matchup basis metadata to `meta.matchup_basis`. This was needed
because repeating full metadata exceeded the complete two-result context budget.
The 12-player screen plus five-player logs/rates/quotes fixture measures 24,955
bytes, including structured content and JSON text fallback, below 32 KiB.

The hosted query skill and direct-URL tool hints route prop questions through the
screen and shortlist. The new developer guide covers exact lines, market-family
separation, sample denominators, quote freshness and bounded follow-ups. Installed
plugin skills require the separately approved plugin release to distribute updates.

Validation completed

- `npm test` passed 171 tests with two existing platform-dependent skips.
- Official SDK HTTP tests exercise the new delegated read and revoked-token denial.
- Old-server, unsafe-descriptor, bounds, no-retry, two-call and context-budget tests pass.
- `npm run audit:prod` passes with zero production vulnerabilities.
- `npm run typecheck`, `npm run build`, `npm run pack:check`,
  `npm run distributions:check` and `npm run mcpb:check` passed.
- `git diff --check` passed.

The initial production audit failed on the existing transitive @hono/node-server
2.0.12 advisory. The lock now selects 2.1.6, the same update in open Dependabot
PR #35. This overlap is confined to package-lock.json. No unfinished branch was
incorporated. Reconcile that identical lock update when merging either PR.

The matching application source is contract 1.19.0, app PR #836, code checkpoint
`b4c569d6def5a2171b5e193cf202268f6ae3b02d`, following merged screen PR #835.
Its `STATS_API_PROP_EVIDENCE_ENABLED` flag defaults false and has not been changed
in any deployed environment. Backend promotion precedes gateway promotion.

Remaining work includes PR CI and explicit owner merge approval in this repository,
then authorized sandbox activation/native-client and real busy-slate capacity
acceptance. Offline fixtures establish no live latency or owner-acceptance record.
Record the exact deployed app/MCP SHAs and measured p95 at five concurrent users,
check backpressure at the configured gateway ceiling, and keep temporary sandbox
credentials in process environment only. The backend flag is the first rollback
control. Production uses the current native approval/runtime compatibility gates.
