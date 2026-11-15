# NHL ranked shortlist adapter

Writer: Codex root, Windows desktop. Branch codex/nhl-ranked-shortlist from
c8176c46c41b7b5299425e15433b12adf9fe7bf4. Backend companion starts at
8f2a049b2dda36fef2ab2b583b562e5d084daac6. No unfinished dependency incorporated;
unrelated Dependabot PR37 remains untouched. Previous operations branches remain
pushed and preserved. Dedicated fresh worktrees; original checkouts untouched.

Approved implementation: negotiate compact_v4 and explicit view=shortlist, globally
season-gap-ranked distinct players with disclosed pool/ranking scope; flat ordered
candidates and self-contained team_contexts; optional current stored Gamecenter
offer sidecars without rewriting accepted prose/citations. Shortlist first-page
context defaults false, research retains first/continuation defaults. Keep old
API compatibility and refuse unavailable explicit selectors without silent fallback.
Ten globally selected distinct players from140 selections must fit one protected
call<=32KiB. Samples/gaps remain descriptive, never model probabilities or EV.

Update shared local/hosted workflow guidance and safe catalog identifier. One
protected backend request per call, no HTTP/player fan-out or retries. Use official
fresh SDK fixture clients for sorting/capability/ref/payload checks and full mcp
profile. Backend must deploy before the negotiated adapter; live sandbox/Redis/
OAuth/actual-client acceptance binds the new exact pair before production.

Status: implementation and local validation complete, preparing source PR. No
deployment/account mutation for this update. Code and final pushed checkpoints
will be recorded after committing. Existing authorization continues, with explicit
canonical merge/owner record and native human prod gate. No npm/plugin/MCPB
publication, new grants/rollout scope, DDL or generation.

Validation: Node22/npm ci; full mcp profile passed: 221 tests passed/2 skipped,
production audit (zero vulnerabilities), typecheck, build, pack:check,
distributions:check and unsigned mcpb:check. Both local/hosted query skills passed
quick_validate. Acceptance JavaScript syntax and git diff --check passed. The
manifest descriptions intentionally change, so its distribution snapshot hash was
updated after confirming no secret/config/version change; the earlier hash-only
failure is resolved. SDK fixture checks include one protected top-ten call from a
140-selection pool, global continuation ranks and quote/citation page preservation.

Code checkpoint: fddbcf6a48f2d2664bac4b6a4b6662f3c2d79e5d, pushed and remote
verified. The following handoff-only commit is distinct from the code checkpoint.

Remaining: source CI; backend1.26 deployment before adapter sandbox; explicit
canonical merge permission; new real-Redis/fresh OAuth and actual Claude checks;
owner exact-pair acceptance record and production human approval. Old acceptance
records remain unchanged and establish no acceptance for this new runtime.
