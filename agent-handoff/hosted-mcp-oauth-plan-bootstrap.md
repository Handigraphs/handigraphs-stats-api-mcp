# Hosted MCP OAuth planning bootstrap

- Purpose: make the reviewed static hosted MCP OAuth plan available in the canonical adapter repository before adapter implementation dispatch.
- Branch: `codex/hosted-mcp-oauth-plan-bootstrap`.
- Base: fetched `origin/main` at `9a4c2f8088467a234cf454e531de160969d5ffd1`.
- Active writer: Codex `graph_review` sub-agent in the hosted MCP implementation team, Windows local environment, 2026-10-19.
- Status: documentation bootstrap; no implementation, provisioning, activation, release or manual merge is included.
- Planning source checkpoint: application shaping commit `f7d255d740da3123131ae6ee0fdf3b4ede16c123`; the four documents are copied byte-identically.
- Code checkpoint: none; documentation only. The final handoff checkpoint is this branch's PR head, independently verifiable from GitHub.

## Scope and dependencies

Adds only `plans/hosted_mcp_oauth/{brief.md,research.md,plan.md,state.yaml}` and this note. No runtime source, lockfile or local distribution changes. Dependency-update PRs #16 and #17 touch only `package-lock.json`, with no overlap.

Nine-shard graph: PR-01 is initially ready in the separate application repository; adapter PR-06 is blocked on application PR-03. This docs PR needs an explicitly authorized manual merge before spawned adapter implementation can rely on the plan being on `main`. The application and adapter retain their distinct merge/release policies.

## Validation

- Node 22.14.0; `npm ci` passed.
- `npm run audit:prod` passed with zero vulnerabilities.
- `npm test` passed: 66 passed, 2 macOS-only skips.
- `npm run typecheck`, `npm run build`, `npm run pack:check`, `npm run distributions:check` and `npm run mcpb:check` passed. MCPB verification built an unsigned local artifact only; nothing was published.
- Document hashes matched the application shaping copy; static graph JSON parses with nine unique shard IDs and valid dependencies.
- No new behavioral test is applicable to a byte-identical documentation copy; the existing repository package suite is still run. No live credentials or environment files are needed.

## Remaining

Merge only with explicit authorization, then dispatch adapter implementation after its application dependency has merged. Infrastructure, secrets, hosted changes, production activation and publication remain separate approvals. Actual acceptance evidence stays private; the bootstrap contains non-secret design and release policies.

## SHA-256 document hashes
- brief.md: 285df43f0be3fafc60eee2217592f957ffbe695f4b36d141c3359957a5bdd62d
- research.md: a91d21b98682521ca4d3f8f028fd0897c2d55d99f5ee4c1838a8fae2eaea27cf
- plan.md: dedcecf2747f35f0860fa610578bcbafe59b7fd9b21ec89afbaddbca9059976e
- state.yaml: cf920f61ff07f2edf37d6fae1879a8d06d11755fdacf1b8d208bf0b18afcf786
