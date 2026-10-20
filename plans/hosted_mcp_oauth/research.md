# Hosted MCP OAuth — Shaping Evidence

Inspected 2026-10-17, read-only. Application source: fetched `origin/main` at `b39a240161ae251541bdf51e46711fa7762a42ef`. The primary checkout was 96 commits behind and dirty, so evidence comes from the remote-tracking source and the brief uses its own worktree. No open application PRs were returned at inspection; the older remote `codex/agent-filter-research-brief` was treated as historical/unknown writer state, not reused.

External adapter source previously inspected in this conversation: `Handigraphs/handigraphs-stats-api-mcp` at `9a4c2f8088467a234cf454e531de160969d5ffd1`, package source version 0.3.0. Source/package publication and deployed runtime compatibility are separate facts; neither was verified by inspecting package.json.

## R1 — Existing Identity and OAuth Gap

- `web/backend/routes/auth_routes.py`: email/password login through the current User model; creates an access JWT with an eight-hour expiry.
- `web/backend/app.py`: Flask-JWT-Extended JWTManager and matching expiry configuration.
- Targeted search across backend routes/services/models and root dependencies found no existing OAuth authorization-code/PKCE/refresh-token server or Authlib dependency. This is a bounded orientation finding, not an exhaustive security audit.
- Reuse login, accounts and subscription identity. OAuth discovery, client registration, authorization grants, refresh/revocation and browser consent are additional work. A website JWT is not an MCP OAuth token.

## R2 — Reusable Policy, but Key-Coupled Request/Worker Authorization

- `services/stats_api_policy.py`: pure eligibility and agent rollout functions; All Access, qualifying affiliates, no active trial, current Terms and rollout decisions. Write/research permissions use `filters:write` and `research:run`.
- `services/stats_api_access.py`: `AuthenticatedApiKey` includes a StatsApiKey and User. `require_stats_api_key` exposes key-specific Flask globals and calls shared per-user quotas with key observability. Defaults are 60 protected requests/minute and 5,000/day, with a maximum of two active personal keys; runtime overrides were not read.
- `services/stats_api_agent_access.py`: composes key authentication and checks `g.stats_api_key.permissions`.
- `services/stats_api_research.py`: submission passes `key_id` into the jobs service.
- `services/research_jobs.py`: persists `api_key_id`; `_api_entitled` checks the key and current policy at submission/worker boundaries. OAuth therefore needs credential-aware execution authorization, not only HTTP request verification.
- `plans/agent_filter_research/operations.md`: source/deployment/worker acceptance are independent; permissions default on but user intent and current eligibility remain mandatory.

## R3 — Observed Existing Infrastructure

Host CLI authentication was verified as the expected GitHub and Heroku accounts. Only read-only inventory commands were used; no config secrets, customer keys, user records, database contents, or billing credentials were fetched.

| Environment | Running processes | Existing data services | Region/stack |
|---|---|---|---|
| Production `handigraphs` | web: Standard-2X; worker: Standard-1X; researchworker: Standard-1X | Postgres Essential-2; Redis Premium-1; Scheduler Standard | US / heroku-24 |
| Sandbox `handigraphs-sandbox-web` | web, worker, researchworker: Basic each | Postgres Essential-2; Redis Mini | US / heroku-24 |

Evidence: `heroku ps --json`, `heroku addons --json` with output projected to process names/sizes/state and add-on plan/state; `heroku apps:info --json` projected to region/stack. One process of each listed type was observed up. A `heroku formation` query was unsupported by the installed CLI; no mutation was attempted and configured formation beyond running inventory was not established.

`web/Procfile` separates public web, Anthropic worker and research worker. Existing source integrates Sentry and Redis. No current utilization, pool headroom, bill, worker heartbeat, rollout configuration, or exact deployed source SHA was measured. Postgres and Redis are shared capacity dependencies, including any other apps attached to them.

## R4 — Published Pricing and Inference

[Heroku pricing](https://www.heroku.com/pricing/) inspected 2026-10-17:

- Basic: $7/month; Standard-1X: $25/month; Standard-2X: $50/month.
- Postgres Essential-2: $20/month, 40 connection limit. Standard-0: $50/month, 120 connections. An upgrade costs $30/month extra per database at list price.
- Redis Mini: $3/month, 25 MB / 20 connections. Premium-1: $30/month, 100 MB / 80 connections. These are plan ceilings, not available headroom.
- Proposed separate MCP apps: $25 production + $7 sandbox = $32/month extra. Two production instances + sandbox = $57/month extra. Existing workers/data services are not charged a second time in this baseline.
- Each additional Standard-1X research worker would be $25/month, but worker/database benchmarks and operator approval are required before scaling. More workers can increase shared DB contention.
- No new model inference is inherent in hosting these deterministic adapter tools. More adoption can increase existing API and research load.

Prices are public full-month list prices, not a quote, purchased capacity, or a provider selection exercise. No resources were created, purchased, attached, resized or deployed.

## R5 — Transport, OAuth and Distribution Evidence

- [Canonical adapter entrypoint](https://github.com/Handigraphs/handigraphs-stats-api-mcp/blob/9a4c2f8088467a234cf454e531de160969d5ffd1/src/index.ts) launches stdio and resolves a single process credential. `server.ts` creates API clients around that credential. Shared hosted instances require request-scoped identities.
- [Plugin configuration](https://github.com/Handigraphs/handigraphs-stats-api-mcp/blob/9a4c2f8088467a234cf454e531de160969d5ffd1/plugins/handigraphs-stats-api/.mcp.json) uses `npx -y @handigraphs/stats-api-mcp`; it does not pin a package version. A new package can be picked up on launch, but this is not an active-process hot update. Separate installed skills remain local artifacts.
- [Codex MCP documentation](https://learn.chatgpt.com/docs/extend/mcp?surface=cli) and [Claude Code MCP documentation](https://code.claude.com/docs/en/mcp) document remote HTTP and OAuth support. End-to-end compatibility with actual target versions remains an acceptance task.
- [MCP authorization specification](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization) establishes protected-resource and authorization-server discovery, PKCE, client registration options, token audience/resource binding and the prohibition on token passthrough to downstream resources. Select protocol/SDK versions during planning; do not treat the cited revision as a promise that every supported client implements all later mechanisms.

## User Decisions and Validation Limitations

The user explicitly selected unchanged eligibility, Codex/Claude Code hosted support with Claude Desktop local initially, and separate Heroku hosting using existing account/data infrastructure. The local option remains required.

This evidence supports shaping, not a deployment or security sign-off. No live API credential was used, no protected endpoint or research execution was triggered, and no application test pass is claimed. Document whitespace validation passed. The initial pre-push smoke hook stopped before tests because this docs-only worktree has no Python virtual environment; the documentation checkpoint uses the repository's scoped smoke bypass rather than installing the application test stack. Estimate: 15–25 person-days, including the newly identified worker credential dependency. Library selection and real load acceptance remain planning/implementation work.

## R6 — Shard Planning Verification (2026-10-18)

### Verified code findings

- Both source heads remain the SHAs recorded above. The application has no open PRs; the adapter has two dependency-update PRs (`qs` and `fast-uri`). There is no overlapping OAuth feature PR. The shaping branch is clean, two documentation commits ahead of application main, and has no PR. Remote branch presence is not proof another writer is idle.
- `stats_api_access.AuthenticatedApiKey`/`require_stats_api_key` populate `g.stats_api_key` and `g.stats_api_key_id`; capability route/service and permission decorator dereference the key, as does research submission. These are concrete integration points for the principal shard.
- `research_job_schemas.define_tables` defines `angles_research_jobs`, its origin check (`website`, `stats_api`), nullable `api_key_id` FK with SET NULL, per-owner idempotency domain and active-owner index. Contracts 1/2 are website NHL/MLB and 3/4 are key-auth API NHL/MLB. `ResearchJobStore._api_entitled` uses short shared-lock transactions for current source-key/user/Terms authorization; `_publication_allowed` checks before result publication. `submit` counts stats_api daily admission across keys/namespaces. New contracts and grant checks must preserve these paths.
- The actual `.github/workflows/migration-diff.yml` guard explicitly permits `web/backend/tests/test_migrations.py` alongside migrations (and the migrations README/release smoke script). PR-01 can therefore include real schema regression tests in that existing test file without changing runtime models. The migration guide requires sandbox verification and production schema promotion before dependent code PRs.
- CI uses root `requirements.txt`, while web deploy dependencies are `web/requirements.txt` (there is no `web/backend/requirements.txt`). Both need compatible OAuth dependencies. Pytest's existing three testpaths and unique module basename rule remain applicable.
- `App.jsx`, `ProtectedRoute.jsx`, and `Login.jsx` preserve a narrowly parsed research return path; they do not currently provide an OAuth continuation. `ApiAccessPage.jsx` is the existing Terms/key/usage surface. Browser OAuth consent and connected apps are new components, not an existing account tab.
- The application graph `plans/agent_filter_research/state.yaml` already uses `repositories` plus `shard.repository` and explicit `gh --repo` routing. The stock global ship/land examples still assume a single repo; explicit per-shard routing remains required rather than assumed automatic.
- External `.agents/pipeline.yml` requires a dedicated worktree, PR flow and `test-build-pack`; its full validation runs npm ci, test, audit:prod, typecheck, build, pack:check, distributions:check and mcpb:check. External CI aggregates Linux/macOS/Windows. External AGENTS requires explicit merge/release/hosted-change authorization; there is no auto-merge or local UI gate.
- External plugin IDs, marketplaces and `check-distributions.mjs` assume one local `handigraphs-stats-api` entry, npx configuration, sensitive API-key setup and stdio MCPB. A separate hosted entry is needed to avoid migrating existing installations silently. External server/http code captures one configured key; public discovery has a shareable TTL/ETag cache, while account capability reads are fresh.

### Documented capabilities, not completed integration

- [Authlib Flask AuthorizationServer API](https://docs.authlib.org/en/latest/oauth2/authorization-server/flask/api.html) documents Flask integration and registered grant extensions; [PKCE extension](https://docs.authlib.org/en/stable/oauth2/specs/rfc7636.html) documents the maintained code-challenge implementation. Selecting it does not establish a working application OAuth server or built-in RFC8693 support. The plan explicitly makes exchange a narrow tested grant extension. [Upstream license](https://raw.githubusercontent.com/authlib/authlib/main/LICENSE) is BSD-3-Clause; commercial support is optional. Recheck the exact selected release and dependency compatibility during PR-02.
- [Codex official MCP documentation](https://learn.chatgpt.com/docs/extend/mcp?surface=cli) documents DCR/CIMD, configured clients and loopback/issuer callback behavior. [Claude Code documentation](https://code.claude.com/docs/en/mcp) documents DCR, CIMD and configured OAuth client support. DCR is the planned common baseline; exact Codex desktop/CLI and Claude Code versions still require real acceptance. No CIMD capability will be advertised by this first implementation.
- [Stable TypeScript SDK server documentation](https://ts.sdk.modelcontextprotocol.io/server) documents stateless Streamable HTTP and JSON responses. Current adapter SDK is 1.31.0; a v2 migration is not required by the plan. Client compatibility and multi-instance behavior remain acceptance tests.
- [RFC8693](https://www.rfc-editor.org/rfc/rfc8693.html) defines token exchange. The proposed exchange uses a confidential gateway and explicit resource binding rather than forwarding an MCP bearer token to the data API. This is a proposed contract, not a verified existing endpoint.

### What this changes

- Nine PRs replace the initial 6–8 sizing guess: schema, OAuth server, API principal, worker authorization, UI, hosted transport, deployment, additive plugin packaging, and acceptance. Packaging is separated from deployment so local install identity and hosted operational rollout can be checked independently.
- Use separate OAuth grant persistence and worker execution contracts 5/6; retain origin and user budget domains. No personal-key slots or plaintext key storage are needed.
- Keep the prior $32/month incremental baseline ($57 with two production instances) as an unmeasured list-price scenario. Retain the 15–25 person-day effort envelope with explicit risk in custom exchange and actual client acceptance. No live utilization, new pricing quote, release compatibility or capacity claim was established on 2026-10-18.
- Public adapter workflows cannot read private application Actions with their default GITHUB_TOKEN. Cross-repo release preflight needs explicitly approved read-only evidence access; missing evidence blocks release. The plan does not authorize configuring that credential.
- Planning validation is document/graph validation only. Missing PyYAML in local runtimes is avoided by using YAML 1.2's JSON-compatible syntax and validating the exact serialized graph with the standard-library JSON parser. No application tests, infrastructure mutations, live OAuth requests, package installs or new agents were run for this plan.
