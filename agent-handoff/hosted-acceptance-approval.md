# Hosted acceptance issue approval compatibility

- Branch: `codex/hosted-acceptance-approval`.
- Status: source complete, awaiting root final review before push/Ready PR.
- Purpose: consume the private application's v2 acceptance issue-approval proof
  without weakening the public MCP repository's native production approval.
- Base: freshly fetched external `origin/main`
  `1d1560fc59eb72f0d7d3a51eda57822b346f4cc3`. Canonical remote is
  `Handigraphs/handigraphs-stats-api-mcp`; no open PR at task start. The unrelated
  stale Windows setup branch has no verifier/workflow overlap and was preserved.
- Sole writer: Codex `schema_review`, Windows desktop / PowerShell, dedicated
  `.worktrees/mcp-acceptance-approval`. Canonical checkout and dirty app main are
  untouched. `plan_bootstrap` and `graph_review` independently reviewed read-only.
- Code checkpoint: `2b2098fa19549a28e3a8ba5024b4e05310b37c86`.
  This subsequent continuity-only commit has a separate SHA reported at handoff.
  Nothing pushed; no PR exists. Normal hooks were enabled (no bypass).

## Contract and boundaries

- v2 manifests require exactly method `github_issue_v1`, issue/comment IDs and
  the observation `review_sha256`; v1 and native private-environment fallback
  deliberately fail. The exact request/body/canonical digest agrees with the
  app producer and shared synthetic golden fixture.
- Fixed private-repository GETs independently verify the open non-PR bot issue,
  exact body, complete bounded no-Link/<100 comments and pinned comment. Only the
  fixed human owner can approve. Commands trim surrounding whitespace; the
  highest-ID exact APPROVE must be pinned. Any owner edit or exact REJECT blocks
  future use; agents never approve. Missing Issues read access fails closed.
- Approval+300 seconds <= original publication <= dispatch+1800 seconds. These
  historical publication bounds coexist with seven-day evidence use/freshness;
  consuming valid evidence next day is covered, not falsely treated as expired.
- After fixed current sandbox release/slug/health reads, re-read both current
  main refs and current private approval. A pair or decision changed during those
  reads blocks. Existing archive/inner digest, workflow/source/run/attempt,
  metrics, cleanup, release and health checks remain mandatory.
- Public native production approval is unchanged. Both existing single-private-
  repository App token mint sites request Issues read alongside existing read
  scopes. Installing App permissions, credentials, environments or access remains
  a separately authorized operation; source provisions none.
- Only pair+evidence digest leaves the verifier. Private issue/comment IDs,
  approval data, signed URLs and raw API bodies are never printed publicly.
- No runtime tools, package version/manifests, local setup, publishing behavior
  or deployed configuration changed. This coordinates with the private app's
  approval counterpart; neither fixture success nor source merge is acceptance.

## Validation and environment

- Node22.14.0, fresh locked `npm ci`; process-local cache under `.tools/npm-cache`.
  No .env copying or live key supplied. All endpoint/issue/platform tests mocked.
- Full exact recorded mcp profile exit0: `npm ci`, then `npm run test`,
  `audit:prod`, `typecheck`, `build`, `pack:check`, `distributions:check`,
  `mcpb:check`, stopping on each nonzero exit. Tests111 passed,2 macOS-only skips
  on Windows; new approval companion11 all passed with zero skips. Production
  dependency audit0 vulnerabilities; install reports2 existing dev advisories.
  Package, local/candidate distributions and unsigned MCPB checks all passed.
- After final source-ref freshness fix: `npm test`111 passed/2 platform skips and
  `npm run typecheck` exit0. Final workflow both-mint read-permission assertions:
  `npm run build:test` + `node --test .test-dist/tests/hosted-deploy.test.js`11/0skip,
  exit0. YAML parsing and `git diff --check` passed. No failing checks waived.
- Shared Python/JS synthetic vector digest is
  `d323123eb1c0f951010be898c0df28c50d02c82c4183feceacd566fcc4279f65`.
  Root separately reports actual app-generated v2 manifest passes these JS exports;
  those app tests were run by root, not claimed as this worktree's own run.
- `.tools/` contains task-generated npm cache/logs only and is untracked, excluded
  from selective staging. Dependencies/build outputs are ignored normally. Do not
  stage generated artifacts or infer operational acceptance from those fixtures.

## Remaining delivery and operations

Both independent source reviews are clear. Root final review precedes push/Ready
PR; then normal cross-platform test-build-pack CI applies. External merges need
explicit authorization; no auto-merge is configured here. Before PR fetch current
main, reconcile any changes, verify remote checkpoint and GitHub mergeability.

No real issue/comment/approval, workflow dispatch, access/config provisioning,
secret change, client configuration, acceptance/load/cleanup exercise, deployment,
activation, publication, manual merge or Atlas operation occurred. All operational
prerequisites remain separate; private native environment availability is not
claimed or used as a fallback.
