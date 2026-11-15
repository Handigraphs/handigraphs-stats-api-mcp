# NHL brief pagination and availability

Writer: Codex root, Windows desktop. Branch codex/nhl-brief-pages from
dbfe125bb23669be38bf3fef10704016237ffb2b. Companion backend branch of the same
name starts at aec596bf9d51bf21c5d0f3d48feb47b88db16dee. No unfinished dependency;
the existing node-forge Dependabot PR is independent and was not incorporated.

Approved scope: negotiate advertised compact_v3 pages/context/pregame controls;
explain truthful player report matches and factual teammate flags; shared game,
player and statistical-outcome relationships without forecasts/settlement merges.
Preserve current ranking/gates, unpaged v1/v2 compatibility and one protected GET
per tool call, bounded <=32KiB with no retries or silent selector fallback.

First page defaults to pregame context; continuations omit context, keeping exact
selection controls. Snapshot expires180s/eight newer owner snapshots; cache loss
is explicit. Pages disclose frozen observations and current age/start labels,
never live injury/starter clearance. Candidate IDs and page counts must reconcile.

Source implemented. Full MCP suite213 passed/two platform skips; audit:prod0,
typecheck/build/pack/distributions/MCPB passed. Fresh official-client fixture
retrieves19 in two protected GETs with no repeated context; malformed/expired
pages do not retry or restart. Shared hosted/local guidance retains parity and
both skills passed quick_validate. Existing three dev-only audit highs remain
outside production dependencies; no lockfile changes or Dependabot integration.
Operator cohort now checks complete bounded snapshot paging, candidate match/
relationship metadata and cross-owner cursor denial via private ephemeral IPC.
No cursor/auth body enters its aggregate reports. Syntax checks passed; live run
is still pending. Live acceptance must bind new backend/gateway SHAs;
prior acceptance cannot be relabeled. Retain native human production approval.
No package/plugin/MCPB publication, account mutations or infrastructure changes.
