# November 14 slate and OAuth acceptance

The owner explicitly authorized sandbox database/OAuth-client acceptance followed
by production deployment. Tested app `eadd76610a683390a356ed82f7ebe829dbbb9e92`
(contract 1.23.0, sandbox web v1464) and hosted gateway
`d3ea0c45619c3e1e5e229d076284789caf16d5c1` (sandbox v16).
The passing private, redacted observation record has SHA-256
`2ffdf24b723e67710996c056edcdd5305384ef067ecfd887b913e859fd032580`.
Successful exact-source GitHub deploys and fixed-app release metadata were checked
independently before and after the run and bound to that record. The web workflow
stages shared Python files, so its Heroku artifact commit differs from its source.
The gateway's optional runtime build_sha was null; source identity comes from the
observed deployment record, not a fabricated runtime timestamp or caller label.

## Observed checks

- A complete live slate initially failed the 8 MiB source budget because unused
  legacy odds data was transferred. The app now projects only versioned tracking
  offers before the existing byte checks. Three actual PostgreSQL regressions in
  an owned disposable loopback database passed, covering >8 MiB unused legacy
  input, large individual legacy documents and genuinely oversized offers.
- Sandbox lacked today's lineup/starter context. A bounded copy of today's four
  fixed NHL context tables from production read-only retained source timestamps.
  Odds, historical actuals, tracking records and customer accounts were not copied.
- A fresh synthetic paid sandbox owner accepted current Terms. Its temporary key
  digest was verified against its actual stored identity. The deployed REST brief
  returned all 14 games and 12 candidates in one protected read: 28,511 bytes and
  an observed 1,500 ms. This is one functional observation, not a latency SLO.
- Playwright Chromium 147.0.7727.15 signed in and clicked the actual consent page.
  Official MCP SDK 1.32.1 discovered resource/issuer metadata, dynamically
  registered, and completed state/issuer-bound PKCE authorization.
- A fresh hosted connection listed 24 tools with `get_slate_brief`, unrestricted
  discovery-validated evidence section names and catalog `slate-brief-v1`.
  All five advertised evidence sections were invoked successfully. The drill-down
  retained exact player, market, slate, season, game type, line and quote identity;
  hit counts, rates and samples matched the candidate.
- The complete serialized MCP brief was **32,419 bytes**, within 32 KiB, containing
  14 games and 12 candidates, including a confirmed-starter saves candidate.
  Its observed warm read was 801 ms. Missing/stale offers, low samples, unresolved
  identities and unconfirmed starters remained disclosed exclusions. No eligible
  blocks quote was manufactured. Evidence drill-down was 5,253 complete MCP bytes.
- Two refresh generations rotated access and refresh credentials. Each used a
  new actual MCP connection and protected read. Browser Account revocation was
  followed by a completed gateway 401 using the still-live frozen access token,
  then invalid_grant for refresh. No auto-reconnection masked the denial.
- This run used five successful protected business reads: one REST brief, one
  hosted full brief, one evidence drill-down and two fresh post-refresh reads.
  No unexpected 429 or 503 occurred. Stateless GET-stream 405 responses are the
  supported transport behavior; the SDK's POST reads completed normally.
- Cleanup removed the exact synthetic owner/key/grant/token/client records and
  own allowlist membership, restored temporary sandbox flags, and retained no
  journal. Independent queries confirmed no synthetic run records remained.

Two preliminary harness attempts are retained as failures in private evidence:
one public restart-readiness timeout; then a password-label locator timeout before
OAuth. The second account's key was revoked, and scoped cleanup was completed
after correcting ORM deletion to use PostgreSQL credential cascades. Neither
attempt was relabeled a passing OAuth test. The final fresh run passed all checks.

## Scope and rollout

This is real browser and official-client functional acceptance. Native Codex,
Claude and ChatGPT product clients were not retested, and historical client
versions in the owner record stay explicitly historical. This is not a new load,
worker, queued-job or cross-account campaign. Existing client catalogs may still
need refresh/reconnection to obtain the new tool. No npm/plugin publication is
implied by deploying source.

The prior November 14 prop-packet acceptance remains unchanged in
[its historical record](owner-acceptance-2026-11-14-prop-packet.json).
Production requires the existing owner/runtime comparison and native human
environment gate. Promote compatible web readers before the provenance-producing
stats scraper and gateway. Activate the brief separately after deployed readiness;
disable only STATS_API_SLATE_BRIEF_ENABLED to roll it back.
