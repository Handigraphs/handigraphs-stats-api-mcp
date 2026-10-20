# Handigraphs Stats API MCP agent guide

This public Apache-2.0 repository is the canonical local stdio adapter. The REST
service lives separately in cjbuskey/handigraphs-app. Use Node 22 and follow
CONTRIBUTING.md, SECURITY.md and .agents/pipeline.yml.

Use a dedicated worktree and codex/ task branch from fetched origin/main. Inspect
open PRs and preserve unrelated work. Record the active writer, base, validation,
checkpoint and remaining work in the plan's per-shard progress fragment (or a
tracked agent-handoff note for an unplanned task). Push task-scoped checkpoints.
Open a ready PR after validation; CI is test-build-pack across Linux, macOS and
Windows. There is no auto-merge or local UI gate. Merging, tagging, publishing npm
or MCPB releases and hosted changes require explicit user authorization.

Run the full mcp validation profile before requesting review. Use mocked REST
endpoints and the official MCP client. Never use a live credential without a
user-supplied temporary sandbox key held only in the process environment. Keep
stdout reserved for MCP protocol, diagnostics on stderr, and credentials out of
arguments, URLs, fixtures, logs and tool results. Preserve bounded same-origin
requests, no redirects, no automatic retries and old-server stats compatibility.
Do not introduce generic HTTP tools or hosted transports.

## Hosted MCP implementation boundary

The explicitly authorized hosted_mcp_oauth PR-06 adds an opt-in Node 22
entrypoint, `npm run start:hosted`, alongside the unchanged local stdio launch.
This is the scoped exception to the stdio-only development rule above; it does
not authorize hosting, rollout changes, secrets, a release or publication.
Hosted source is not an available service or product-client acceptance result.

Use `HANDIGRAPHS_HOSTED_ENABLED=true`, `HANDIGRAPHS_MCP_RESOURCE_URL` (the exact
HTTPS `/mcp` endpoint), `HANDIGRAPHS_OAUTH_ISSUER` (HTTPS application origin),
`HANDIGRAPHS_MCP_SERVICE_CLIENT_ID` and the separate
`HANDIGRAPHS_MCP_SERVICE_SECRET` only in the runtime environment. `PORT` defaults
to 3000. No user API key is read by this entrypoint. Validate with synthetic
loopback issuers, never live customer credentials. The loopback HTTP test switch
`HANDIGRAPHS_HOSTED_ALLOW_LOOPBACK=true` is forbidden with production NODE_ENV or
any Heroku DYNO. Host defaults to the configured resource authority; optional
`HANDIGRAPHS_HOSTED_ALLOWED_HOSTS` and `HANDIGRAPHS_HOSTED_ALLOWED_ORIGINS` are
comma-separated exact allowlists. Forwarded headers never grant trust.

Every MCP message exchanges its own opaque MCP token at the configured issuer;
only the resulting short-lived API token enters a fresh private client. Never
store or share user tokens, private capabilities or account responses. Only the
unauthenticated discovery client/cache is shared. Hosted exposes the same 19
business tools and omits local key setup. Backend permission/worker availability
remains authoritative; PR-03 research-unavailable is a normal interim result.

Bounds default to 128 KiB incoming, 5 MiB upstream, 2 seconds for the complete
body, 5 seconds for exchange, 8 seconds for an API fetch, 15 seconds per protocol
request and 20 concurrent requests. The corresponding `HANDIGRAPHS_HOSTED_`
MAX_BODY_BYTES, BODY_TIMEOUT_MS, EXCHANGE_TIMEOUT_MS, REQUEST_TIMEOUT_MS and
MAX_CONCURRENCY variables can lower or conservatively adjust the validated
limits. No automatic request retry or historical-computation stream is added.
SIGTERM/SIGINT stop admission and drain short active requests for at most five
seconds. `/health/ready` is local config/process readiness, not live backend,
worker, deployment or launch proof. Run the complete mcp profile including
official-client HTTP/stdio isolation tests and all packaging checks.

For agent_filter_research, the copied static plan preserves its original text.
The user's subsequent permission decision (implemented by app PRs 733/734)
supersedes its default-off wording: new and existing keys receive filters:write
and research:run by default, owners can disable either, and rotation preserves
their choices. Eligibility and rollout gates remain enforced. Permissions never
substitute for user intent: explicit create requests authorize a new save;
replacements require confirmation. PR-07 adds reads only; actions, workflow skill
and distribution version changes belong to PR-08. Publication is separate.
