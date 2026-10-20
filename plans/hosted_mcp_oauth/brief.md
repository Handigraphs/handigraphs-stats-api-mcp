# Hosted MCP with OAuth — Brief

**Status:** shaped · **Date:** 2026-10-17

## Purpose

Make Handigraphs' hosted MCP the default connection for Codex and Claude Code so eligible subscribers connect once through their Handigraphs account and receive centrally deployed adapter improvements. Preserve the local stdio MCP and API-key workflow as a supported alternative. Reuse the existing Stats API, account policy, saved objects, research queue, and workers; add OAuth authorization and a separate hosted transport rather than another implementation of sports analytics.

**Concrete example:** An eligible All Access subscriber adds the Handigraphs hosted connection in Codex, signs into Handigraphs in the browser, accepts current API Terms if needed, and approves the displayed permissions. They ask, "Run my Volume shooters filter for today's NHL slate." The agent retrieves the same account-owned saved filter available on the website and runs it against today's Eastern slate. A later request to test season SOG/G >= 3 with TOI/G >= 1080 seconds against Over 2.5 SOG uses advertised completed dates, submits a bounded research job, and returns its job ID. Reconnecting tomorrow does not require a local Node package installation or an API key. If the subscriber instead uses local stdio in Claude Desktop, their existing API key and saved objects still work. Revoking the Codex connection prevents further calls and prevents its queued research from starting without valid authorization.

## Locked Product Decisions

| Decision | Value |
|---|---|
| Default and fallback | Hosted MCP becomes the recommended connection. Keep the npm/stdin-stdout adapter, existing API keys, local setup, and local distributions supported. No forced key rotation, local uninstall, or automatic migration of an existing connection. |
| First-release clients | Require end-to-end hosted compatibility with Codex and Claude Code. Keep Claude Desktop on its existing local option for this release. Do not claim compatibility with untested clients or publication in their directories. |
| Eligibility | Retain the existing Stats API policy: active paid All Access or an existing qualifying All Access affiliate, no active trial, current Terms, and applicable Stats API/agent rollout gates. Check current policy on requests and research execution, not only during connection. |
| Hosting | Use a separate Heroku MCP app in production and a separate sandbox MCP app, in the existing US region. Reuse the Handigraphs account/backend, Postgres, Redis, and observability infrastructure where capacity permits. No new external identity provider or database is required by the product scope. |
| User authentication | Use a browser-based OAuth authorization-code flow with PKCE and the existing Handigraphs login/account identity. Do not ask users to paste API keys or website JWTs into the hosted connection. Use a maintained OAuth implementation; do not invent a protocol or build token cryptography by hand. |
| Permissions and consent | Make reads, filter/idea writes, and historical research identifiable in consent and enforceable independently. Preserve current permission semantics and explicit save/replacement intent rules. OAuth permission is not user authorization to save or replace an object. Connections are individually inspectable and revocable in the account UI. |
| Credential boundary | OAuth connections are separate grants, not silently generated long-lived personal API keys. Do not consume the two personal-key slots or persist customers' plaintext keys. Keep MCP-audience tokens distinct from website JWTs and downstream API credentials; use a validated, audience-bound internal authorization path. No shared privileged customer identity. |
| Shared enforcement | Generalize the API-key-specific authentication boundary to an explicit credential/principal model while preserving the existing key path. Reuse canonical entitlement, ownership, permission, quota, saved-filter, and research services. Apply aggregate user quotas across local keys and hosted grants; connecting twice must not double a user's budget. Charge protected business requests once, not once at each transport layer. |
| Asynchronous authorization | Research submitted with OAuth retains the submitting grant's identity. Revalidate it before queued execution and at existing safe execution boundaries; revoked or no-longer-eligible grants cannot authorize queued work. Define safe handling of already-running stages during planning. Do not convert OAuth jobs into unrestricted website-origin jobs. |
| Tool and object parity | Share tool contracts/handlers in the canonical external adapter repository. Preserve the distinction among saved filters, saved Angles ideas, and temporary research jobs. Hosted/local clients see the same user-owned objects and supported business capabilities; local credential setup is transport-specific. |
| Release behavior | Deploy hosted handlers and tool definitions centrally behind a stable HTTPS endpoint. Preserve compatible contracts and safe retries/idempotency. Explain that client-side tool caching can still require reconnect/new conversation and that separately installed skills can still need updates. Do not promise instantaneous refresh in an active chat. |
| Load boundary | Keep MCP request handling lightweight and horizontally scalable. Persist job/grant state outside individual instances and return job IDs promptly. Do not hold a connection open for historical computation. Protect the existing subscriber web app and research queue with existing capacity guards plus appropriate hosted admission controls. |
| Rollout and authority | Validate in sandbox, enable a limited cohort, then expand using explicit operational authorization and measured capacity. Local access remains available during rollout/rollback. This brief authorizes no provisioning, production writes, deployment, OAuth registration changes, merge, or package publication. |

These are settled. Later stages do not re-litigate them. If an implementer believes one is wrong, they stop and ask the developer rather than editing this table.

## Existing Patterns to Mirror

- `web/backend/routes/auth_routes.py` and `web/backend/app.py` — existing user login and eight-hour website JWT; reuse identity and login experience, not the website token as an MCP credential.
- `web/backend/services/stats_api_policy.py` — pure current entitlement and agent rollout decisions, including affiliate and trial behavior.
- `web/backend/services/stats_api_access.py` and `stats_api_agent_access.py` — API identity composition, fresh authorization, per-user Redis quotas, permission checks, and structured errors. Their key-specific assumptions must be deliberately generalized.
- `web/backend/services/research_jobs.py` and `stats_api_research.py` — owned jobs, idempotency, stored submitting credential, and worker-time entitlement checks. Preserve existing API-key jobs during the OAuth transition.
- `web/backend/routes/stats_api_account_routes.py` and `web/frontend/src/components/Account/ApiAccessPage.jsx` — account access, Terms, permissions, revocation, and no-store responses; extend with connected applications rather than replacing keys.
- `web/Procfile`, `.github/workflows/deploy-web-sandbox.yml`, and `deploy-web-prod.yml` — current process/deploy conventions. A second app needs explicit deployment configuration and release gates; an existing worker process is not another publicly routed web endpoint.
- `https://github.com/Handigraphs/handigraphs-stats-api-mcp` — canonical Node 22 adapter, schemas, discovery, bounded HTTP, credential redaction, mocked REST/official-client tests, stdio entrypoint, and plugin packaging. Add the hosted entrypoint there; do not copy its tools into this monorepo.
- `plans/agent_filter_research/operations.md` — keep source presence, deployed compatibility, research readiness, and launch acceptance as separate claims.

## Architecture and Delivery Boundaries

The hosted path is client -> HTTPS MCP service -> existing Handigraphs API -> existing data/cache/research services. The browser login/consent and OAuth grant lifecycle use the Handigraphs account backend. The adapter obtains or conveys a validated API-specific delegated principal through an explicitly designed internal contract. The precise token format/exchange is planning work; blindly forwarding the incoming MCP access token to a different resource is excluded.

The local path remains client -> local stdio adapter -> API-key-authenticated Handigraphs API. Share transport-independent tool behavior, schemas, and error handling. Public discovery may be shared/cached; account data and credential context must remain isolated. Do not introduce a direct database connection from each MCP instance merely to bypass API authorization.

OAuth persistence belongs in reviewed `public.*` Flask migrations. Preserve this repository's separate migration/code PR rule. Account UI changes require local review under the pipeline policy. Update repository/skill instructions that currently restrict the MCP to stdio as part of the authorized implementation, while preserving local behavior. No implementation or PR breakdown is written by this shaping stage.

## Cost and Effort Envelope

Read-only inventory on 2026-10-17 confirmed production runs one Standard-2X web process, one Standard-1X general worker, and one Standard-1X research worker; sandbox runs Basic equivalents. Both have Essential-2 Postgres; production Redis is Premium-1 and sandbox Redis is Mini. These are existing costs, not new hosted MCP expenses. See `research.md` for source revisions and limitations.

| Incremental item | Monthly list-price allowance | Assumption |
|---|---:|---|
| One production MCP Standard-1X | $25 | Separate lightweight Node service. |
| One sandbox MCP Basic | $7 | Separate non-production endpoint. |
| Initial compute subtotal | $32 | Existing account/data services have adequate headroom. |
| Optional second production MCP Standard-1X | +$25, $57 subtotal | Independent instances; does not make the shared backend/database fully highly available. |
| Additional production research worker | +$25 each | Only after database/queue benchmarks and explicit scaling approval. Not automatically required by hosting. |
| Possible Postgres Essential-2 -> Standard-0 upgrade | +$30 per upgraded database | $20 -> $50 list price; capacity decision, not a launch prerequisite established by this inspection. |
| New identity-provider subscription | $0 in selected scope | OAuth implemented with a maintained library on existing Handigraphs infrastructure; engineering and ongoing maintenance still apply. |

These are full-month published compute/data list prices, not a bill quote or a measured capacity guarantee. Exclude taxes, discounts, domain changes, extra monitoring charges, one-off dynos/CI, and usage-driven upgrades. Existing Sentry and logging integrations can be reused; no monitoring capacity entitlement was verified. No new model inference is required by the transport.

**Engineering estimate: 15–25 person-days (120–200 hours), roughly 3–5 full-time engineering weeks**, before user-review/calendar waits. At an illustrative $100/hour that is $12,000–$20,000 of engineering effort, not a vendor quote. This replaces the earlier broad estimate: data services and workers already exist, but an OAuth server and credential-independent worker authorization do not.

| Work area | Person-days |
|---|---:|
| OAuth grant/client lifecycle, maintained-library integration, login/consent and revocation | 5–8 |
| Shared credential/principal, quota and research-worker authorization changes | 3–5 |
| Hosted transport, shared adapter behavior and deployment configuration | 2–4 |
| Account/connect UX, client acceptance, security/failure/load checks and rollout documentation | 5–8 |

These are sizing work areas, not ordered shards. Assume no identity-system replacement, local rewrite, or unbounded historical workload. Registration compatibility, migrations and actual capacity can change the estimate during planning.

## Out of Scope

- Remote Claude Desktop, ChatGPT directory submission, and other clients in this first release; retain their existing local support and evaluate remote support separately.
- New subscription tiers, trials, new sports/tools, altered research limits, or relaxed Terms/ownership rules.
- Migrating all website login to OAuth, buying a new identity platform, or requiring customers to create a second identity.
- Hosting LLM reasoning, scraper execution, new research algorithms, permanent report archives, tracking activation, or bet placement.
- Reworking all twenty tool names/schemas as a prerequisite; keep previously identified contract improvements separate unless needed for reliable hosted parity.
- Automatic infrastructure provisioning, production activation, new worker scaling, or npm/MCPB publication as part of shaping or ordinary code merge.

## Unknowns

- **Answered by research R1–R4 (`research.md`):** existing login is JWT-based; key-specific policy and research execution require generalization; Heroku services/workers already exist; incremental baseline compute is $32/month at current list prices.
- **OAuth implementation and supported-client registration:** choose a maintained library, confirm authorization/protected-resource discovery, PKCE, refresh rotation/reuse detection, revocation, audience/resource binding, and the registration mechanism needed by the tested Codex/Claude Code versions — resolve during planning. No consumer identity migration.
- **Internal delegation and data migration:** specify principal/token exchange or equivalent validated API boundary, credential-type persistence, compatibility for old jobs/keys, and grant removal semantics — resolve during planning. Preserve shared user budgets and fail closed on authorization dependency failure.
- **Browser authorization UX:** specify safe login continuation/consent, CSRF protection, redirect validation including desktop loopback rules, and connected-app controls — resolve during planning.
- **Running-job revocation boundary:** specify stage-safe termination, result retention/access after revocation, refresh-token expiry versus grant validity, and user-facing status — resolve during planning. A revoked grant cannot admit new execution.
- **Capacity and health:** benchmark API latency, database connection/query headroom, Redis memory/connections, queue wait and historical service times, hosted bursts, and poll load in sandbox before choosing cohort size or upgrading data services — spike first during implementation, before launch. Inventory is not load evidence.
- **Protocol/client refresh behavior:** test supported Streamable HTTP versions, client reconnect/tool-cache behavior, rotation/revocation, and both clients' consent flows. Avoid process-memory session dependence; handle required legacy protocol state explicitly if unavoidable — resolve during planning.
- **Deployment provenance:** inspect exact deployed release compatibility, existing worker flags/heartbeats, and acceptance evidence before integration testing; running processes do not prove a feature is enabled or healthy — resolve during planning.

## Size Estimate

**Multi-PR, approximately 6–8 PRs across the application and external adapter repositories** — OAuth storage and lifecycle, shared authorization including workers, hosted transport, account UX, deployment and acceptance span separate boundaries, and migrations must remain separate from backend feature code. Exact shards belong to `/shard`.
