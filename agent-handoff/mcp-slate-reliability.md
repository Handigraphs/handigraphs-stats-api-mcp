# Compact slate and effective capability handoff

- Branch: `codex/mcp-slate-reliability`.
- Base: `6a86b37c3594655b1ca7091dcee33c1d691b6ff6`.
- Writer: root Codex session on Windows desktop, November 14, 2026; independent
  review agents are read-only. Continue from the verified remote checkpoint.
- Code SHA: `25ac74c946c196356762f1fe2a5143e825722333`. The later handoff commit is
  distinct from the code checkpoint. Status: implemented and locally validated; PR CI and separate live acceptance remain.

`get_slate_brief` is shared by hosted/local transports, reads one pinned protected
GET, requires an enabled compatible API descriptor, validates date/phase/counts,
and caps the complete redacted text-only tool result at 32 KiB. Existing stats
remain usable on old/disabled servers. No generic HTTP tool or second adapter.
Effective prop sections share execution's compatibility gate and legacy fallback;
runtime metadata distinguishes adapter/catalog/build/API states. Dynamic section
validation avoids a static enum blocking newly advertised sections. Tools may
still require refresh/reconnect in a cached product client.

Paired app branch: `cjbuskey/handigraphs-app` `codex/mcp-slate-reliability`, code
SHA `f3d445cb5165596c82f7a4b86ca84dea213d090e`, REST 1.23.0. Deploy the backend
before using the new tool. Its new feature flag defaults disabled and existing
API/agent eligibility and quotas remain authoritative. App operations are in
`plans/mcp_slate_reliability/operations.md` in that repository.

Full recorded MCP profile passed on Node 22: npm ci, npm test (202 passed, two
platform-specific skips), audit:prod (zero vulnerabilities), typecheck, build,
pack:check, distributions:check and mcpb:check. Official-client fixtures use
synthetic loopback endpoints, fresh connections and no live credentials.
The paired backend full suite passed: 5,451 tests, with 506 optional/environment skips; Ruff, frontend lint/build and the unauthenticated local smoke passed. The authenticated smoke was skipped without configured credentials.

No source tests certify live OAuth/product-client acceptance, database latency or
production payload performance. Separately authorized acceptance needs a fresh
actual client catalog, exact deployed app/MCP SHAs and a temporary synthetic
sandbox credential kept only in process environment. Do not change the committed
owner acceptance or claim an old acceptance record covers this runtime.

Remaining: create/review the PR, watch CI; manual merge, production deployment,
activation and package/plugin publication require their separate authorization.
Source version remains 0.3.0 with a distinct catalog revision; new source features
are not a release claim. Portable setup: Node 22, npm ci and the full MCP profile.
