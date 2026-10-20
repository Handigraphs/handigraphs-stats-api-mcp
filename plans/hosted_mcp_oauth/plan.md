# Hosted MCP with OAuth — Implementation Plan

**Date:** 2026-10-18 · **Dispatch:** sequential · **PR mode:** per-shard

## 1. Purpose

Make Handigraphs' hosted MCP the default connection for Codex and Claude Code so eligible subscribers connect once through their Handigraphs account and receive centrally deployed adapter improvements. Preserve the local stdio MCP and API-key workflow as a supported alternative. Reuse the existing Stats API, account policy, saved objects, research queue, and workers; add OAuth authorization and a separate hosted transport rather than another implementation of sports analytics.

**Concrete example:** An eligible All Access subscriber adds the Handigraphs hosted connection in Codex, signs into Handigraphs in the browser, accepts current API Terms if needed, and approves the displayed permissions. They ask, "Run my Volume shooters filter for today's NHL slate." The agent retrieves the same account-owned saved filter available on the website and runs it against today's Eastern slate. A later request to test season SOG/G >= 3 with TOI/G >= 1080 seconds against Over 2.5 SOG uses advertised completed dates, submits a bounded research job, and returns its job ID. Reconnecting tomorrow does not require a local Node package installation or an API key. If the subscriber instead uses local stdio in Claude Desktop, their existing API key and saved objects still work. Revoking the Codex connection prevents further calls and prevents its queued research from starting without valid authorization.

## 2. Locked Product Decisions

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

## 3. Codebase Context the Implementer Must Know

Checked against application `b39a240161ae251541bdf51e46711fa7762a42ef` and adapter `9a4c2f8088467a234cf454e531de160969d5ffd1`. See `research.md` R1–R6. Both bases were unchanged when fetched on 2026-10-18. The planning branch contains only shaping documents; it has no PR. The adapter has two open dependency-update PRs, not OAuth feature work; recheck conflicts and dependency versions before implementation. A source revision is not a deployed revision or a published package.

| Existing path / symbol | Verified behavior and consequence |
|---|---|
| `web/backend/routes/auth_routes.py:login`, `app.py:JWTManager` | Browser email/password login issues an eight-hour JWT. This remains the website identity mechanism; neither the public MCP nor data API may accept it as an OAuth access token. |
| `models.py:User`, `StatsApiKey`, `StatsApiTermsAcceptance` | Existing `public.user`, `public.api_keys`, `public.api_terms_acceptances` are the account/key/Terms sources. Keys store prefix/digest and two optional permissions; do not generate hidden keys for OAuth. |
| `services/stats_api_access.py:AuthenticatedApiKey`, `authenticate_stats_api_request`, `require_stats_api_key` | Request authentication and downstream Flask globals are key-specific. The decorator owns current eligibility, user-wide quotas, last-used observability and safe response metadata. Introduce an explicit principal without duplicating these checks. |
| `services/stats_api_policy.py:evaluate_policy`, `evaluate_agent_key`, `effective_permissions`; `stats_api_agent_access.py:require_agent_access` | Reuse pure policy/permission rules in HTTP and workers. Base stats access and agent rollout remain separate decisions. |
| `routes/stats_api_agent_routes.py:get_agent_capabilities`; `services/stats_api_agent_contract.py:capabilities` | Both assume a key, including `key.permissions`. Replace that dependency with effective principal permissions and credential-aware research readiness. |
| `routes/stats_api_research_routes.py:submit`; `services/stats_api_research.py:submit` | Submission currently passes `g.stats_api_key.id` into `ResearchJobStore`. PR-03 must explicitly block OAuth submission until PR-04 changes execution authorization. |
| `services/research_job_schemas.py:define_tables`; `models.py:AnglesResearchJob` | Shared, Flask-independent table definitions include `public.angles_research_jobs`, origin (`website` or `stats_api`), nullable `api_key_id`, lease and stage state. Keep origin unchanged for OAuth so existing API budgets still include it. |
| `services/research_jobs.py:ResearchJobStore.submit`, `_api_entitled`, `_publication_allowed`, `claim` | SQL transactions recheck source key/user/Terms and publication rights. User-wide API daily admission uses a PostgreSQL advisory lock across keys/namespaces; owner active-job uniqueness is per namespace. Retain both semantics. |
| `research_job_schemas.py` constants; `workers/research_worker.py` | Existing contracts are website NHL=1, website MLB=2, API-key NHL=3, API-key MLB=4. API request envelopes keep the frozen definition/source filter. OAuth needs new contract support and heartbeat proof without stranding 1–4. |
| `services/stats_api_filters.py:create_filter` | Filter-save idempotency is keyed by `(owner, operation_id)`. Keep this domain across transport/credential changes; a retry must not create another filter merely because a grant/token changed. |
| `app.py` blueprint registrations | Account routes are mounted at `/api`, existing protected resources/agent routes at `/api/v1`. OAuth protocol routes will be new root `/oauth/*` routes, not generic HTTP tools. |
| `frontend/src/App.jsx`, `Auth/ProtectedRoute.jsx`, `Auth/Login.jsx` | Routes and safe login continuation currently preserve only research-return state. Add a strictly parsed OAuth transaction return path; accepting arbitrary `returnTo` would add an open redirect. Existing browser JWT storage is unchanged by this feature. |
| `Account/ApiAccessPage.jsx`; `config/api.js` | Existing `/account/api` is the Terms/key/usage surface. Add a connected-app section without replacing its two-key management. |
| `migrations/README.md`; `.github/workflows/migration-diff.yml:split-check` | Migrations precede dependent code and production schema precedes the code PR. The actual guard permits `tests/test_migrations.py` and migrations README alongside a migration. PR-01 can therefore carry schema behavior tests without changing runtime models. |
| Root `requirements.txt`, `web/requirements.txt`; `pyproject.toml` | CI installs root requirements on Python 3.11; web deployment has its own requirements. Add compatible OAuth dependencies to both. Collected tests belong under existing testpaths and need globally unique basenames. |
| Adapter `src/index.ts`, `server.ts:createServer`, `http.ts:StatsApiHttpClient` | Stdio entrypoint resolves a single credential, server clients capture config, and protected HTTP uses `config.apiKey`. Refactor credential injection at the HTTP boundary; never swap a global key per incoming user. |
| Adapter `src/discovery.ts:DiscoveryClient` | Public discovery has TTL/ETag and in-flight coalescing; account capabilities are fetched fresh. Share only unauthenticated discovery cache across hosted requests. |
| Adapter `package.json`, `tests/stdio-integration.test.ts`, `scripts/check-distributions.mjs` | Node 22, SDK 1.31.0, source version 0.3.0; official-client tests cover stdio and packaging. Distribution checks currently assume a single local plugin. Keep those local assertions and add a separate hosted alternative. |
| Adapter `.agents/pipeline.yml`, `.github/workflows/ci.yml`, `publish.yml` | `test-build-pack` aggregates Linux/macOS/Windows. Releases publish on explicitly published GitHub releases; no hosted deployment exists yet. Do not reuse npm publication as a deployment trigger. |

All new paths/tables/endpoints below are proposed interfaces, not claims that those files or services already exist. Recheck the Alembic head, source baselines, exact running app/worker releases, current credential policy, target client versions and dependency security before their relevant shard. No database schema or running-feature acceptance was inferred from a process listing.

### Cross-repository execution and planning bootstrap

The authoritative graph is `state.yaml`: its root `repo` block snapshots the application pipeline; `repositories.mcp` snapshots the adapter pipeline. Every shard has `repository: app` or `mcp`. The stock `/ship` examples assume one repository, so dispatch must select that field before checkout, GitHub probes and validation. Use `gh --repo cjbuskey/handigraphs-app` or `gh --repo Handigraphs/handigraphs-stats-api-mcp` accordingly. An unavailable probe yields **unknown**, not ready or merged.

Use the canonical adapter's own checkout/worktree for PR-06–08. Never create a monorepo adapter copy. Keep identical, non-secret brief/research/plan/state bootstrap documents in each repository; each implementation PR writes only its own `progress/PR-NN.md` in its own repository. Earlier app/mcp progress fragments need not be copied across repositories: live PR state comes from the owning repository. Before the plan reaches a repository's main, copy the exact checkpointed plan into a new sequential shard worktree as its first commit. Do not silently regenerate it from chat. Cross-repository merge dependencies and deployed compatibility are separate checks.

## 4. Architecture

```text
Codex / Claude Code --authorize--> Handigraphs browser login + consent
        |                              | Authlib / OAuth grants (Postgres)
        | MCP access token             v
        +--HTTPS /mcp--> Node gateway --token exchange--> /oauth/token
                              | API-audience delegation JWT (60 sec)
                              v
                     Existing Flask /api/v1
                              | shared principal, policy, user quotas
                              +--> stats / saved filters / saved ideas
                              +--> research queue --> existing worker
Local client --> stdio adapter --personal API key--^     | recheck grant/key
```

### Planning decisions closing the brief's implementation unknowns

- **Library:** Authlib's Flask authorization-server integration and S256 PKCE extension, with its maintained JOSE dependency for signing/validation. Pin a security-reviewed release compatible with the existing Flask/Python stack in both requirements files; record exact resolved versions in PR-02. Authlib supports custom grant registration; this plan does **not** claim it ships RFC8693 natively. The narrow token-exchange grant is new application integration with standards tests. No new identity vendor or commercial support subscription is assumed.
- **Registration:** initial release uses bounded public Dynamic Client Registration (RFC7591), `token_endpoint_auth_method=none`, authorization-code/refresh grants and no public client secret. Codex and Claude Code document DCR support. Do not advertise CIMD support until implemented; no arbitrary client-metadata URL fetching in this release. Record tested Codex desktop/CLI and Claude Code versions in acceptance evidence. DCR names/URLs are unverified display data, not trusted brand identity.
- **Resource binding:** canonical configured issuer is the Handigraphs application origin; MCP resource is its configured stable `/mcp` HTTPS URL; data resource is the configured application `/api/v1` URL. Sandbox uses separate issuer/resource/secrets. Construct metadata and redirects from validated configuration, not untrusted Host/X-Forwarded headers. Example proposed production resource: `https://mcp.handigraphs.com/mcp`; name/DNS availability remains an operator check.
- **Tokens:** random, opaque MCP access tokens (15 minutes), hashed at rest; rotating refresh-token family with a 30-day inactivity and 90-day absolute limit. Refresh reuse revokes the grant/family transactionally and is tested under concurrency. Grant validity is independent of an individual access token's expiry. Authorization code is single use, expires after 60 seconds, and is bound to client, exact redirect, PKCE and MCP resource.
- **Delegation:** confidential gateway client, authenticated through a separate environment-scoped service secret, exchanges the MCP token at `/oauth/token` using RFC8693 `subject_token` and explicit API audience. The issuer validates the source grant and returns a 60-second signed API token with owner, grant/client identity, scope, auth revision and actor. No refresh token is issued to the gateway. Gateway has no ability to select an arbitrary user; it must present that user's valid subject token. Do not log or pass the subject token onward to protected data routes. Data routes check the delegation JWT **and current persisted grant**, so expiry is not the revocation mechanism.
- **Signing:** separate signing key/algorithm allowlist and audiences from website JWTs; include issuer, audience, expiry, issued-at, JTI, grant ID/revision, subject and actor, and allow only the configured gateway actor. Use maintained signing/verification code; reject missing/incorrect claims and key IDs. Document key rotation with overlap bounded by token TTL. Neither public metadata nor HTTP errors reveal secrets.
- **Scopes:** `stats:read` is required baseline access to existing read capabilities; `filters:write` and `research:run` are separately displayed/authorized. Existing API-key optional permissions stay unchanged. OAuth consent can only narrow requested supported scopes, not add scopes. Editing scope is revoke/reconnect in v1; no silent privilege upgrade. A grant is not bound to or counted as a personal API key.
- **Gates:** `OAUTH_MCP_ENABLED` defaults false; a new hosted rollout mode/allowlist is intersected with existing base/agent policy, never substituted for it. Deployment readiness, account eligibility, Terms, consent and worker readiness remain independent gates. Existing local key access must remain usable when hosted access is disabled.

## 5. Database Design

PR-01 adds only `public.*` schema and tests. Use an additive migration from the actual current Alembic head, not a guessed revision. Proposed UUIDs are generated by application/library code; do not require a new Postgres extension. Reuse the existing integer `public.user.id`; verify exact table/constraint definitions in a disposable PostgreSQL database and migration-diff before release.

| New table | Required fields and relationships | Keys / indexes / constraints |
|---|---|---|
| `oauth_clients` | UUID/string `client_id`; untrusted bounded `client_name`; validated JSONB redirect URIs; supported grant/response types; auth method; created/last-used/expiry timestamps. User-facing DCR clients are public. The single confidential gateway service-client adapter is configured separately, not DCR-created. | PK client_id; expiry index; allow only code/refresh + none for public clients; cap redirect entries (5), metadata/body sizes, and idle registrations. Never store a public-client secret or fetch a submitted logo/client URL. |
| `oauth_grants` | UUID `id`; `user_id` FK CASCADE; `client_id` FK; MCP resource; text-array scopes; positive `auth_revision`; created/last-used/expires/revoked timestamps; refresh inactivity deadline. One explicit consent creates one grant, even if another client of the same name exists. | PK; owner/recent and client indexes; active/expiry lookup; allowed scopes subset check. Revocation retains a tombstone; no immediate hard deletion while jobs/tokens may reference it. |
| `oauth_authorization_codes` | Digest PK; client/user/grant binding; exact redirect; PKCE challenge/method; resource/scopes; created/expires/consumed timestamps. | Unique digest; expiry index; S256 only. Atomic consume with token creation. Codes, verifiers and browser JWTs are never persisted plaintext. |
| `oauth_access_tokens` | Digest PK; grant FK; bound client/resource/scopes/revision; created/expires/revoked timestamps. These are opaque MCP tokens, not API delegation JWTs. | Digest unique lookup; grant and expiry indexes. No plaintext token column. Expired tokens purged in bounded maintenance; live grant checks still required. |
| `oauth_refresh_tokens` | Digest PK; grant FK; family UUID; generation; predecessor/replacement identifier; created/expires/consumed/revoked timestamps. | Digest uniqueness; family/grant/expiry indexes; uniqueness for family generation. Retain used-token digests through the family's validity to detect reuse; lock grant then token consistently during refresh/revoke. |

Code, access-token and refresh-token digests use domain-separated HMAC with a new OAuth-specific pepper, not the personal-key pepper. Never persist bearer secrets. Redirects/client metadata use strict bounded formats and escaped display values. Cross-field rules are enforced in both the store and relevant database constraints; tests exercise races, owner consistency and deletion ordering.

**Research provenance:** add nullable `oauth_grant_id UUID` to `angles_research_jobs`, FK to grants with `ON DELETE SET NULL`, and a lookup index. Keep nullable `api_key_id` and existing origin values. Enforce at most one source credential and prevent website-origin rows from referencing an OAuth grant. A stats_api row with neither source can exist after FK deletion but always fails authorization; new submissions must supply exactly one. Reuse existing owner-scoped idempotency and daily-budget indexes/locks. No existing job rewrite or destructive backfill.

**Temporary browser transaction:** use existing Redis under an environment-specific OAuth namespace for 10-minute authorization request records, one-time decision state, nonce/cookie hashes and bounded protocol rate buckets. Bind the request to a Secure/HttpOnly/SameSite=Lax transaction cookie at the application origin with Path=/, so it reaches both `/oauth/*` and `/api/account/oauth/*`; use a host-only cookie and bound concurrent transactions per browser. JWT-authenticated consent reads bind the logged-in user; decision POST checks the binding and a one-time CSRF nonce. Request IDs in browser URLs carry no token/authorization by themselves. Redis failure fails authorization closed, without making API-key management depend on OAuth Redis state. Any insecure local-loopback test override must be impossible in production.

Public-client registrations without a grant expire after a bounded idle period (proposed 7 days); cap registration rate/body/redirect counts so anonymous setup cannot grow tables without bound. Limit active connected grants to 10 per account initially, separately from the two personal-key slots, with an actionable revoke/reconnect message; do not recycle a grant without consent. Maintenance hooks belong to the store plus an operator-documented bounded cleanup command, not a new always-on worker. Do not purge live grants or refresh reuse evidence prematurely.

Downgrade/round-trip tests run only in disposable local Postgres. Do not downgrade shared sandbox/production for validation. Runtime models arrive in PR-02 and new shared job metadata in PR-04; do not autogenerate removal of migration-only tables in between. Production schema promotion is an explicit gate before opening dependent runtime PRs per the migration guide; if not approved, stop that dependency rather than bundling schema and code.

## 6. Backend Implementation

### OAuth server and browser account APIs — new in PR-02

`services/oauth_server.py` integrates Authlib grants/endpoints, validated metadata, DCR, browser transactions and confidential exchange. `oauth_credentials.py` owns digest/token validation, signing, principal-independent grant policy and startup validation. `oauth_persistence.py` implements ORM/store adapters, locking and bounded cleanup; register the proposed models in `models.py`. Keep fresh entitlement in the existing policy module rather than copying subscription logic into Authlib callbacks.

| Proposed endpoint | Authentication and behavior |
|---|---|
| `GET /.well-known/oauth-authorization-server` | Public static metadata from configured issuer, authorization/token/registration/revocation endpoints, S256, code/refresh grants. No CIMD advertisement. Include issuer-bound response support only when `iss` is actually returned and tested. |
| `GET /oauth/status` | Public, no-store safe availability/recommendation booleans and configured hosted URL; no account IDs or secrets. A separate default-false recommendation flag can become true only after launch evidence and explicit operator activation. The authenticated account payload additionally reports the current user's eligibility. |
| `GET /oauth/authorize` | Validate client, redirect, resource, scope, state and S256 before redirecting anywhere. Store bounded short-lived transaction; redirect to same-origin `/oauth/connect?request=<opaque-id>`. Invalid untrusted redirect gets a local error, never a redirect to that URL. |
| `POST /oauth/register` | Rate-limited/bounded DCR. Client names are unverified. Accept only supported public-client shape; no URL fetching, user-controlled service clients, implicit/password/client-credentials grants. |
| `POST /oauth/token` | Authlib authorization-code/refresh flow for public clients; confidential-only RFC8693 grant for the configured gateway. Exchange validates source MCP audience and exact allowed API resource, cannot widen scope, and never returns a personal key. Return standard OAuth errors, no-store and no credential-bearing logs. |
| `POST /oauth/revoke` | RFC7009-compatible token revocation bound to its client. Connection revoke invalidates the entire grant/family; cross-client token probing does not reveal existence. |
| `GET /api/account/oauth/requests/<request_id>` | Website JWT + transaction cookie. Return safe client/redirect origin, requested/grantable scopes, eligibility, Terms version and one-time consent nonce. No raw code/token/PKCE verifier. |
| `POST /api/account/oauth/requests/<request_id>/decision` | Website JWT, bound transaction, nonce and current eligibility/Terms. Body `{decision: approve|deny, scopes: [...]}`. Consume once; return validated redirect to the OAuth client with code/state/iss or denial. Repeated decisions fail safely; do not remint codes. |
| `GET /api/account/oauth/connections` | Website JWT, owner-only safe list with scopes, created/last-used/expiry/revoked status and unverified client display identity. Listing/revocation remain available after subscription loss. |
| `POST /api/account/oauth/connections/<grant_id>/revoke` | Website JWT, owner-only idempotent revoke plus revision increment; no auto-copy/replacement. Existing completed objects are untouched. |

Use exact registered HTTPS redirects; support RFC8252 native loopback hosts/variable ports with exact host/path matching, including Codex's callback-specific path when presented. No wildcard domains, fragments, userinfo, open callback proxy, or arbitrary custom scheme. Do not assume a desktop callback hostname equals a CLI hostname: capture actual required client redirects during acceptance. Public registration is not proof a client is official; show the registered destination and unverified status clearly.

Suggested protocol limits: 16 KiB registration/token requests; 5 redirects; 120-character client display name; shared Redis buckets for registration, authorization initialization and failed token attempts. Pick conservative defaults and document them separately from user data quotas. No auth endpoint consumes protected stats quota; hostile auth traffic still has independent bounds.

### Shared API identity — PR-03

`services/stats_api_principal.py` introduces an immutable credential-aware identity containing owner, credential kind/ID, effective permissions/scopes, grant revision and actor. Use original personal-key validation unchanged for `hg_live_`/`hg_test_`; accept API delegation JWTs only under the explicit OAuth gate and issuer/audience/algorithm/actor checks. Never try a failed OAuth token as a website JWT or personal key. Each protected request rechecks owner, current grant/revision/revocation/expiry, policy, Terms, rollout and required scope.

Keep `require_stats_api_key` import compatibility while making its implementation compose the common principal. Retain legacy key globals only for key requests; adapt all checked key assumptions (capability route/service, permission decorator and research route). Do not fabricate a StatsApiKey object for OAuth. Data queries, filter/idea services and packet retrieval continue through existing ownership/evaluation code.

Count each protected upstream business request once in existing per-user Redis minute/day counters, shared across keys and grants. Key last-used telemetry stays key-specific; add separately bounded grant observability. Do not put secrets or full token strings in request IDs, cache keys, problem details or Sentry. No account-specific capability/owned-item cache is shared across users. OAuth auth dependency failures return safe 503; source-token expiry/revocation produces a correct OAuth challenge rather than an automatic research resubmission.

Until PR-04, explicitly deny OAuth research POSTs and advertise OAuth historical execution as unavailable. Key research remains unchanged. This is a compatibility state, not a silent fallback to website execution.

### Research execution and revocation — PR-04

Add proposed `OAUTH_API_CONTRACT_VERSION=5` and `OAUTH_API_MLB_CONTRACT_VERSION=6`; keep constants/envelopes 1–4 valid. New workers advertise compatible heartbeats and claim/serialize all supported legacy jobs. Old workers cannot see/claim 5–6. Web admission selects credential-specific readiness and never submits OAuth work merely because a key-only worker heartbeat is fresh. Preserve the namespace and `origin='stats_api'` so daily and active admission remain shared.

Persist the submitting grant, not its short-lived bearer token. Check the corresponding source credential and current owner/Terms/scope/rollout before claim, renewal, stage transitions and publication. Recheck full grant validity even if access-token refresh has not occurred; an expired 15-minute token alone does not cancel a valid grant's job. Revocation, grant expiry or loss of research permission fails work with existing `research_access_revoked` semantics. Do not include credential digests/tokens in job serialization.

Already-running bounded SQL can finish its current stage; suppress further stages/publication after the next authorization boundary. Previously committed stage results remain under existing partial/failure/retention semantics and are not relabeled successful. Revoke and publication use consistent short transaction/row-lock ordering; test the race. A revoked connection cannot fetch results, but a separately valid same-owner key/grant can inspect the owned job and its lawful retained results. Cross-user access remains denied. Do not refund the existing daily submission budget on revoke/cancel/error.

### Hosted adapter — PR-06

Add `hosted-index.ts`, `hosted-auth.ts`, `hosted-config.ts`; keep `index.ts`/stdio and local secure setup behavior intact. Use the already installed stable 1.x SDK `StreamableHTTPServerTransport` with no session ID and JSON responses. Construct/close a request-local server/transport; no process-memory session dependence or sticky routing. Do not require an SDK v2 migration. Validate actual support using the official client and both target products.

`POST /mcp` requires a valid MCP token for initialize, tools/list and tools/call, preventing clients from assuming an authenticated server is anonymous. GET metadata and `/health/live` are public; `/health/ready` exposes only booleans/version compatibility, never credentials or account data. Publish `/.well-known/oauth-protected-resource/mcp` and a correct `WWW-Authenticate` resource-metadata challenge; metadata's resource must equal the configured endpoint. Reject/handle unsupported GET/DELETE methods according to the chosen stateless SDK, without a hanging SSE stream.

For each authenticated MCP request, exchange the subject token at the configured same-origin issuer and inject only the resulting API token into immutable request-local API clients. No process.env mutation, no stored user refresh tokens, no master user, no API-token reuse across users, no automatic retry of mutations. Exchange uses confidential service credentials from runtime configuration; it does not count as a data request. Token failure/insufficient-scope challenges and upstream problems remain distinct.

Share handler registrations and response redaction; hosted exposes the existing 19 business tools, while local Codex can additionally expose `configure_api_key`. Keep that tool and setup skill out of hosted connections. Public discovery cache can be reused independently of the private HTTP client; per-request cache reset must not turn every call into a discovery stampede.

Bound incoming protocol bodies (initial ceiling 128 KiB), upstream response bytes (existing 5 MiB), exchange/upstream timeouts, request concurrency and error output. Respect existing smaller action/rule limits. Apply transport Origin/Host controls and body parsing before SDK dispatch; no permissive credentialed cross-origin browser access. Redact Authorization, service secrets, codes, refresh/subject/delegated tokens and sensitive OAuth query/cookies from logs and traces. Gracefully drain active short requests on shutdown; research remains in the existing queue.

## 7. Frontend Implementation

PR-05 adds `Auth/OAuthConsentPage.jsx`, `Account/ConnectedAppsPanel.jsx` and a small pure `Account/oauthConnectionModel.js`. Add `/oauth/connect` in `App.jsx`; its only URL input is a strictly validated opaque request ID. Extend ProtectedRoute/Login with a narrowly allowed OAuth continuation, preserving existing research handoff and startup-destination behavior. Login cannot return to an arbitrary supplied URL. Clear transient consent state after approval/denial/expiry.

The consent page reads the server-bound transaction, shows unverified client identity/destination, reads/write/research permissions, current eligibility and Terms, and explicit approve/deny actions. Accept Terms through the existing account Terms mechanism; never silently accept them as part of consent. Disable duplicate submissions and treat expired, consumed or browser-mismatched requests as restartable failures. Redirect only to the server-validated decision result. Exclude this page's query/state and all credential transitions from pageview/session-replay/error capture.

ConnectedAppsPanel extends `/account/api` alongside the existing keys and usage, showing connection name/status/scopes/last use/expiry and an explicit revoke action. Never reveal codes/tokens or interpret revoke as deleting filters, saved ideas or reports. Access denial should explain current policy, while allowing a lapsed subscriber to revoke. Existing keys remain independently managed.

Use the same responsive component tree for desktop/mobile. Test both projects, keyboard focus, clear permission copy, denial, reconnect, logout/login continuation, Terms requirements, stale transactions and refresh reuse. PR-05 stops for local review before push: check the actual consent flow, connected-app revoke, personal-key regression and mobile layout. PR-09 adds developer guidance only behind hosted-availability/rollout metadata until evidence and explicit release activation exist; it also stops for local review if copy/layout is visible.

## 8. Phased PR Breakdown

| ID | Repository | Title | Depends on | Owned path entries |
|---|---|---|---|---:|
| PR-01 | app | Add additive OAuth and research credential schema | None | 4 |
| PR-02 | app | Implement OAuth grants, consent APIs and delegated token exchange | PR-01 | 14 |
| PR-03 | app | Share API authorization and user quotas across keys and OAuth grants | PR-02 | 19 |
| PR-04 | app | Authorize OAuth research at admission and worker boundaries | PR-03 | 12 |
| PR-05 | app | Add browser consent and connected-application controls | PR-04 | 12 |
| PR-06 | mcp | Serve shared MCP tools over authenticated stateless HTTP | PR-03 | 17 |
| PR-07 | mcp | Add isolated hosted deployment and release gates | PR-05, PR-06 | 13 |
| PR-08 | mcp | Add hosted plugin entries while retaining local distributions | PR-07 | 12 |
| PR-09 | app | Package cross-repository OAuth acceptance and launch evidence | PR-08 | 9 |

### PR-01 — Add additive OAuth and research credential schema (app)

**Repository/service:** `cjbuskey/handigraphs-app` / `web-schema`. **Branch:** `codex/hosted_mcp_oauth-pr01`.

**Depends on:** None.

**Scope:** Add the five OAuth persistence tables and nullable OAuth research-grant provenance specified in Database Design. Keep old rows/code valid. Add real PostgreSQL upgrade/downgrade/re-upgrade and constraint tests to the explicitly allowed test_migrations.py companion; inspect the actual Alembic head and retain one linear head.

**Out of scope:** No ORM/runtime/auth/UI/dependency changes, no grant creation/backfill, no deployed flag changes. Do not remove key provenance or existing research execution contracts.

**Owns:**

- `web/backend/migrations/versions/*_hosted_mcp_oauth.py`
- `web/backend/migrations/README.md`
- `web/backend/tests/test_migrations.py`
- `plans/hosted_mcp_oauth/progress/PR-01.md`

**Must not touch:** `web/backend/models.py`, `web/backend/routes/**`, `web/backend/services/**`, `web/backend/workers/**`, `web/frontend/**`, `requirements.txt`, `web/requirements.txt`.

**Validation:** run profiles `schema`, `python-lint` from Section 9 in the selected repository. Profile commands and repository-required checks both apply.

### PR-02 — Implement OAuth grants, consent APIs and delegated token exchange (app)

**Repository/service:** `cjbuskey/handigraphs-app` / `web-backend`. **Branch:** `codex/hosted_mcp_oauth-pr02`.

**Depends on:** PR-01.

**Scope:** Use Authlib Flask authorization-code/refresh/PKCE integration, hashed credential storage, DCR, resource-bound metadata, browser transaction/consent APIs, connected-grant listing/revocation, and a narrow RFC8693 exchange grant for the confidential MCP gateway. Keep everything default-disabled and validate runtime secrets/issuer/audiences before enabling. Exchange returns a 60-second API-audience JWT, not a personal key.

**Out of scope:** No protected Stats API acceptance of delegated tokens yet, no research worker admission, no visible UI, no gateway provisioning. Token exchange is an explicit Authlib grant extension with RFC tests; do not assume native RFC8693 support or introduce an external identity service.

**Owns:**

- `requirements.txt`
- `web/requirements.txt`
- `web/backend/models.py`
- `web/backend/app.py`
- `web/backend/services/oauth_server.py`
- `web/backend/services/oauth_credentials.py`
- `web/backend/services/oauth_persistence.py`
- `web/backend/routes/oauth_routes.py`
- `web/backend/routes/oauth_account_routes.py`
- `web/backend/tests/services/test_oauth_server.py`
- `web/backend/tests/routes/test_oauth_routes.py`
- `web/backend/tests/routes/test_oauth_account_routes.py`
- `web/backend/tests/services/test_stats_api_startup_config.py`
- `plans/hosted_mcp_oauth/progress/PR-02.md`

**Must not touch:** `web/backend/migrations/versions/**`, `web/backend/services/stats_api_access.py`, `web/backend/services/research_jobs.py`, `web/backend/workers/**`, `web/frontend/**`.

**Validation:** run profiles `oauth`, `python`, `python-lint` from Section 9 in the selected repository. Profile commands and repository-required checks both apply.

### PR-03 — Share API authorization and user quotas across keys and OAuth grants (app)

**Repository/service:** `cjbuskey/handigraphs-app` / `web-backend`. **Branch:** `codex/hosted_mcp_oauth-pr03`.

**Depends on:** PR-02.

**Scope:** Introduce an explicit immutable principal with credential kind/ID, owner, scopes and grant revision. Keep the current require_stats_api_key import as a compatibility wrapper while composing current eligibility/ownership/quota enforcement. Accept only API-audience delegation JWTs or original personal keys, not MCP tokens or website JWTs. Adapt capability/permission code and credential-safe observability. Keep all OAuth research submit paths explicitly unavailable until PR-04.

**Out of scope:** No OAuth queued execution or hosted exposure. No separate hosted quota allowance, widening of trial/tier policy, shared privileged account, change to personal-key limits, or user-specific response caching.

**Owns:**

- `web/backend/services/stats_api_principal.py`
- `web/backend/services/stats_api_access.py`
- `web/backend/services/stats_api_policy.py`
- `web/backend/services/stats_api_agent_access.py`
- `web/backend/services/stats_api_agent_contract.py`
- `web/backend/routes/stats_api_agent_routes.py`
- `web/backend/routes/stats_api_research_routes.py`
- `web/backend/services/stats_api_problem_codes.py`
- `web/backend/tests/fixtures/stats_api_problem_scenarios.json`
- `web/backend/tests/services/test_stats_api_principal.py`
- `web/backend/tests/services/test_stats_api_agent_access.py`
- `web/backend/tests/routes/test_stats_api_agent_routes.py`
- `web/backend/tests/routes/test_stats_api_v1_routes.py`
- `web/backend/tests/routes/test_stats_api_filter_routes.py`
- `web/backend/tests/routes/test_stats_api_account_routes.py`
- `AGENTS.md`
- `CLAUDE.md`
- `.agents/skills/stats-api/SKILL.md`
- `plans/hosted_mcp_oauth/progress/PR-03.md`

**Must not touch:** `web/backend/migrations/versions/**`, `web/backend/services/oauth_server.py`, `web/backend/services/oauth_credentials.py`, `web/backend/services/research_jobs.py`, `web/backend/workers/**`, `web/frontend/**`.

**Validation:** run profiles `principal`, `oauth`, `python`, `python-lint` from Section 9 in the selected repository. Profile commands and repository-required checks both apply.

### PR-04 — Authorize OAuth research at admission and worker boundaries (app)

**Repository/service:** `cjbuskey/handigraphs-app` / `web-research-worker`. **Branch:** `codex/hosted_mcp_oauth-pr04`.

**Depends on:** PR-03.

**Scope:** Carry oauth_grant_id for stats_api-origin work without converting it to website-origin work. Add OAuth-specific NHL/MLB execution contracts 5/6 alongside unchanged 1-4. Recheck credential ownership, grant expiry/revision/scopes, account/Terms/rollout at claim, lease/stage/publication boundaries. Maintain existing user-wide daily budget and idempotency domain across keys/grants/namespaces. Deny admission without OAuth-capable worker heartbeats; preserve legacy key/website jobs and 24-hour report retention.

**Out of scope:** No new research engine, queue namespace splitting to evade budgets, worker scaling, data backfill, report archive, retroactive mutation of completed reports or forced interruption of SQL midway through an existing bounded stage.

**Owns:**

- `web/backend/services/research_job_schemas.py`
- `web/backend/services/research_jobs.py`
- `web/backend/services/stats_api_research.py`
- `web/backend/services/stats_api_agent_contract.py`
- `web/backend/routes/stats_api_research_routes.py`
- `web/backend/workers/research_worker.py`
- `web/backend/tests/services/test_oauth_research_jobs.py`
- `web/backend/tests/services/test_research_jobs.py`
- `web/backend/tests/services/test_stats_api_research.py`
- `web/backend/tests/routes/test_stats_api_research_routes.py`
- `web/backend/tests/workers/test_research_worker.py`
- `plans/hosted_mcp_oauth/progress/PR-04.md`

**Must not touch:** `web/backend/migrations/versions/**`, `web/backend/services/oauth_server.py`, `web/backend/services/oauth_credentials.py`, `web/backend/services/stats_api_access.py`, `web/backend/services/simulation/**`, `web/frontend/**`, `scrapers-stats/**`, `shared/**`.

**Validation:** run profiles `research`, `principal`, `python`, `python-lint` from Section 9 in the selected repository. Profile commands and repository-required checks both apply.

### PR-05 — Add browser consent and connected-application controls (app)

**Repository/service:** `cjbuskey/handigraphs-app` / `web-frontend`. **Branch:** `codex/hosted_mcp_oauth-pr05`.

**Depends on:** PR-04.

**Scope:** Add /oauth/connect using an opaque short-lived transaction selector, safe login continuation and explicit consent. Reuse existing JWT login and current Terms UI flow without exposing tokens in URLs/storage/logs beyond existing website login behavior. Extend /account/api with independently revocable connected apps while keeping personal-key management intact. Cover denial, expired requests, lapsed eligibility, duplicate submissions, revocation, and desktop/mobile accessibility.

**Out of scope:** No website identity migration, API-key rotation, remote Claude Desktop, marketing recommendation of an unvalidated endpoint, automatic local-plugin migration or analytics capture of authorization request query/cookies/tokens.

**Owns:**

- `web/frontend/src/App.jsx`
- `web/frontend/src/components/Auth/Login.jsx`
- `web/frontend/src/components/Auth/ProtectedRoute.jsx`
- `web/frontend/src/components/Auth/OAuthConsentPage.jsx`
- `web/frontend/src/components/Account/ConnectedAppsPanel.jsx`
- `web/frontend/src/components/Account/oauthConnectionModel.js`
- `web/frontend/src/components/Account/ApiAccessPage.jsx`
- `web/frontend/src/config/api.js`
- `web/frontend/tests/unit/oauthConnectionModel.test.js`
- `web/frontend/tests/e2e/hosted-mcp-oauth.spec.ts`
- `web/backend/tests/routes/test_oauth_account_routes.py`
- `plans/hosted_mcp_oauth/progress/PR-05.md`

**Must not touch:** `web/backend/migrations/versions/**`, `web/backend/services/**`, `web/backend/routes/oauth_routes.py`, `web/backend/routes/oauth_account_routes.py`, `.agents/pipeline.yml`.

**Validation:** run profiles `ui`, `oauth` from Section 9 in the selected repository. Profile commands and repository-required checks both apply.

### PR-06 — Serve shared MCP tools over authenticated stateless HTTP (mcp)

**Repository/service:** `Handigraphs/handigraphs-stats-api-mcp` / `mcp-hosted`. **Branch:** `codex/hosted_mcp_oauth-pr06`.

**Depends on:** PR-03.

**Scope:** Add a separately launched Node 22 HTTP entrypoint using the current stable SDK's stateless StreamableHTTPServerTransport and JSON response mode. Protect the complete /mcp endpoint, advertise protected-resource metadata, perform confidential token exchange for each authenticated protocol request, and construct request-local tool/API clients. Share existing tool handlers and read-only discovery caching; use only delegated API tokens for protected upstream calls. Add body/time/concurrency bounds, OAuth challenges, redaction, health and graceful shutdown. Preserve stdio protocol and the local configure_api_key tool; omit local setup from hosted tools.

**Out of scope:** No customer key storage, global mutable per-user configuration, MCP-to-database connections, persistent session affinity, HTTP endpoint provisioning, plugin replacement, SDK v2 migration or npm/MCPB release.

**Owns:**

- `src/hosted-index.ts`
- `src/hosted-auth.ts`
- `src/hosted-config.ts`
- `src/server.ts`
- `src/http.ts`
- `src/config.ts`
- `src/redaction.ts`
- `package.json`
- `package-lock.json`
- `tests/hosted-http.test.ts`
- `tests/hosted-auth.test.ts`
- `tests/mcp-tools.test.ts`
- `tests/stdio-integration.test.ts`
- `AGENTS.md`
- `CLAUDE.md`
- `SECURITY.md`
- `plans/hosted_mcp_oauth/progress/PR-06.md`

**Must not touch:** `src/credentials.ts`, `src/setup.ts`, `runtime/**`, `plugins/**`, `mcpb/manifest.json`, `.github/workflows/publish.yml`, `.github/workflows/deploy-mcp-*.yml`.

**Validation:** run profiles `mcp` from Section 9 in the selected repository. Profile commands and repository-required checks both apply.

### PR-07 — Add isolated hosted deployment and release gates (mcp)

**Repository/service:** `Handigraphs/handigraphs-stats-api-mcp` / `mcp-deployment`. **Branch:** `codex/hosted_mcp_oauth-pr07`.

**Depends on:** PR-05, PR-06.

**Scope:** Build the Node service from the external repository with a hosted-only Procfile/start command and fixed sandbox/production app targets. Add opt-in sandbox deployment and main-only exact-SHA production dispatch with a production environment gate and paired app/MCP acceptance evidence preflight. Test workflow/manifest validation offline. Document proposed app/domain names, service credential/secret installation, health, rollback and cost without creating resources. Keep npm/MCPB publishing separate.

**Out of scope:** No Heroku app/DNS/credential/environment provisioning, shared Postgres/Redis attachments to the gateway, data-service upgrades, automatic production deploys, activation or API bill inference.

**Owns:**

- `Procfile`
- `package.json`
- `package-lock.json`
- `.github/workflows/deploy-mcp-sandbox.yml`
- `.github/workflows/deploy-mcp-prod.yml`
- `scripts/check-hosted-deploy.mjs`
- `tests/hosted-deploy.test.ts`
- `.github/workflows/ci.yml`
- `.agents/pipeline.yml`
- `AGENTS.md`
- `CLAUDE.md`
- `docs/hosted-operations.md`
- `plans/hosted_mcp_oauth/progress/PR-07.md`

**Must not touch:** `src/**`, `plugins/**`, `runtime/**`, `mcpb/**`, `.github/workflows/publish.yml`.

**Validation:** run profiles `mcp` from Section 9 in the selected repository. Profile commands and repository-required checks both apply.

### PR-08 — Add hosted plugin entries while retaining local distributions (mcp)

**Repository/service:** `Handigraphs/handigraphs-stats-api-mcp` / `mcp-distribution`. **Branch:** `codex/hosted_mcp_oauth-pr08`.

**Depends on:** PR-07.

**Scope:** Add a distinct handigraphs-stats-api-hosted plugin/server identity for Codex and Claude Code with HTTP/OAuth configuration and transport-appropriate query/research skills. Preserve the existing local plugin ID, npx configs, sensitive key setup and stdio MCPB. Extend distribution checks to verify both alternatives, no key setup tool/skill in the hosted plugin, and shared business tool descriptions. Use direct-URL connection instructions for pre-release testing; public recommendation/publication remains gated on PR-09 evidence.

**Out of scope:** No automatic migration of installed local connections, remote Claude Desktop bundle, tool renaming/consolidation project, new public package version/tag or npm/MCPB publication.

**Owns:**

- `plugins/handigraphs-stats-api-hosted/**`
- `.agents/plugins/marketplace.json`
- `.claude-plugin/marketplace.json`
- `plugins/handigraphs-stats-api/skills/query-handigraphs-stats/SKILL.md`
- `plugins/handigraphs-stats-api/skills/research-handigraphs-filters/SKILL.md`
- `scripts/check-distributions.mjs`
- `tests/hosted-distributions.test.ts`
- `README.md`
- `docs/codex-setup.md`
- `docs/releasing.md`
- `CHANGELOG.md`
- `plans/hosted_mcp_oauth/progress/PR-08.md`

**Must not touch:** `src/**`, `runtime/**`, `plugins/handigraphs-stats-api/.mcp.json`, `plugins/handigraphs-stats-api/mcp.claude.json`, `plugins/handigraphs-stats-api/.codex-plugin/plugin.json`, `plugins/handigraphs-stats-api/.claude-plugin/plugin.json`, `mcpb/manifest.json`, `.github/workflows/deploy-mcp-*.yml`, `.github/workflows/publish.yml`.

**Validation:** run profiles `mcp` from Section 9 in the selected repository. Profile commands and repository-required checks both apply.

### PR-09 — Package cross-repository OAuth acceptance and launch evidence (app)

**Repository/service:** `cjbuskey/handigraphs-app` / `web-acceptance`. **Branch:** `codex/hosted_mcp_oauth-pr09`.

**Depends on:** PR-08.

**Scope:** Add a fixed-sandbox, default-off audit/evidence wrapper with offline tests, trace-disabled browser coverage, version-paired operational checklist and gated developer guidance. Require measured Codex desktop/CLI and Claude Code consent/refresh/revocation, local stdio parity, queued-job revocation, cross-user isolation, limits, rolling-worker compatibility and load evidence before recommending/publishing the hosted default. Keep safe stopped/incomplete evidence truthful; no fixture pass is launch evidence.

**Out of scope:** No production audit writes, automatic account creation, real research/save calls without a specifically authorized disposable sandbox run, customer credentials, permanently authenticated traces, unreviewed cohort expansion, deployment, merge or publication.

**Owns:**

- `web/backend/scripts/audit_hosted_mcp_oauth.py`
- `web/backend/tests/scripts/test_audit_hosted_mcp_oauth.py`
- `.github/workflows/hosted-mcp-oauth-evidence.yml`
- `web/frontend/tests/e2e/hosted-mcp-oauth.spec.ts`
- `web/frontend/src/components/Developers/DevelopersPage.jsx`
- `web/frontend/tests/e2e/stats-api-agent-handoff.spec.ts`
- `.agents/skills/stats-api/SKILL.md`
- `plans/hosted_mcp_oauth/operations.md`
- `plans/hosted_mcp_oauth/progress/PR-09.md`

**Must not touch:** `web/backend/migrations/versions/**`, `web/backend/services/**`, `web/backend/workers/**`, `web/backend/routes/**`, `.github/workflows/deploy-web-prod.yml`, `.github/workflows/post-deploy-sandbox-web.yml`.

**Validation:** run profiles `acceptance`, `web-frontend`, `python`, `python-lint` from Section 9 in the selected repository. Profile commands and repository-required checks both apply.

### Dependency graph and dispatch

```text
PR-01 app schema -> PR-02 app OAuth -> PR-03 app API principal
                                           |               |
                                           v               v
                                    PR-04 app worker   PR-06 MCP HTTP
                                           |               |
                                           v               |
                                    PR-05 app UI -----------+
                                           |
                                           v
                                    PR-07 MCP deploy
                                           |
                                    PR-08 MCP plugins
                                           |
                                    PR-09 app acceptance
```

Recommended order: **01, 02, 03, 04, 05, 06, 07, 08, 09**. The first ready wave is PR-01 only. PR-06 is graph-independent of PR-04/05 after PR-03, but the default remains one at a time in this chat; no parallel sessions or agents are requested.

**PR per shard:** schema must precede runtime, application and adapter deploy separately, and the work spans weeks. Combined units are deliberate: OAuth consent APIs and grant/token lifecycle are one coherent security boundary; worker admission and execution checks stay together; browser consent and connected-app revocation share one visible review. Hosted transport, deployment and plugin packaging are separate because each is independently testable/revertible.

## 9. Testing Requirements

Profiles below come from each repository's pipeline snapshot plus scoped tests proposed for this feature. New test paths are created by their owning shard. Use a correctly provisioned worktree venv and Node 22; commands run from that shard's repository root. Do not copy .env files or inherit the shaping-only smoke bypass. No live customer API key or OAuth grant is a fixture.

### Application profiles

Required checks: `frontend-lint-build`, `backend-tests`, `python-lint`.

**`web-frontend`**

```powershell
cd web/frontend && npm run lint && npm run build
```

**`python`**

```powershell
venv/Scripts/python.exe -m pytest
```

**`python-lint`**

```powershell
ruff check web/backend scrapers-stats/scrapers scrapers-web shared
```

**`schema`**

```powershell
$env:PYTHONPATH = "$PWD/web/backend;$PWD"
& ./venv/Scripts/python.exe -m pytest web/backend/tests/test_migrations.py -q
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
# Require the new PostgreSQL cases with ANGLES_MIGRATION_TEST_ADMIN_URL; a skip is not acceptance.
```

**`oauth`**

```powershell
$env:PYTHONPATH = "$PWD/web/backend;$PWD"
& ./venv/Scripts/python.exe -m pytest web/backend/tests/services/test_oauth_server.py web/backend/tests/routes/test_oauth_routes.py web/backend/tests/routes/test_oauth_account_routes.py web/backend/tests/services/test_stats_api_startup_config.py -q
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
```

**`principal`**

```powershell
$env:PYTHONPATH = "$PWD/web/backend;$PWD"
& ./venv/Scripts/python.exe -m pytest web/backend/tests/services/test_stats_api_principal.py web/backend/tests/services/test_stats_api_agent_access.py web/backend/tests/routes/test_stats_api_agent_routes.py web/backend/tests/routes/test_stats_api_v1_routes.py web/backend/tests/routes/test_stats_api_filter_routes.py web/backend/tests/routes/test_stats_api_account_routes.py web/backend/tests/services/test_stats_api_problem_manifest.py -q
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
```

**`research`**

```powershell
$env:PYTHONPATH = "$PWD/web/backend;$PWD"
& ./venv/Scripts/python.exe -m pytest web/backend/tests/services/test_oauth_research_jobs.py web/backend/tests/services/test_research_jobs.py web/backend/tests/services/test_stats_api_research.py web/backend/tests/routes/test_stats_api_research_routes.py web/backend/tests/workers/test_research_worker.py -q
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
```

**`ui`**

```powershell
node --test web/frontend/tests/unit/oauthConnectionModel.test.js
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
npm --prefix web/frontend run lint
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
npm --prefix web/frontend run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Push-Location web/frontend
try { npx playwright test tests/e2e/hosted-mcp-oauth.spec.ts tests/e2e/stats-api-access.spec.ts tests/e2e/stats-api-agent-handoff.spec.ts --project=desktop --project=mobile --trace=off; if ($LASTEXITCODE -ne 0) { throw 'OAuth browser tests failed' } } finally { Pop-Location }
```

**`acceptance`**

```powershell
$env:PYTHONPATH = "$PWD/web/backend;$PWD"
& ./venv/Scripts/python.exe -m pytest web/backend/tests/scripts/test_audit_hosted_mcp_oauth.py -q
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
node --test web/frontend/tests/unit/oauthConnectionModel.test.js
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Push-Location web/frontend
try { npx playwright test tests/e2e/hosted-mcp-oauth.spec.ts --project=desktop --project=mobile --trace=off; if ($LASTEXITCODE -ne 0) { throw 'OAuth browser tests failed' } } finally { Pop-Location }
```

### External MCP profiles

Required checks: `test-build-pack`.

**`mcp`**

```powershell
npm ci
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
foreach ($script in @('test','audit:prod','typecheck','build','pack:check','distributions:check','mcpb:check')) {
  npm run $script
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
```

Required behavior beyond command exit codes:

- **PR-01:** actual PostgreSQL schema round-trip; old website/key job rows survive; FK/constraint/tombstone cases, scope checks and unique refresh generations are exercised. Missing disposable Postgres is an unrun check, not success. Require migration-diff and split-check in addition to normal app checks.
- **PR-02:** S256 required, wrong/missing verifier, code reuse, state/resource/redirect mismatch, unregistered clients, DCR bounds/SSRF avoidance, refresh rotation/replay/race, scope narrowing, browser nonce/cookie/owner binding, denial, one-time decision, lapsed eligibility and cross-user revoke. Test exchange cannot impersonate a user, widen scope or return a token for an arbitrary audience. No plaintext credentials in persistence/logs.
- **PR-03:** old keys and website flows unchanged; raw MCP tokens/website JWTs rejected by data routes; wrong issuer/audience/algorithm/actor/revision rejected; grant changes effective next request; stats/query/filter/idea ownership; shared user quotas across multiple keys/grants; temporary research denial and accurate capabilities. Redis/database failure must not become OAuth access.
- **PR-04:** real PostgreSQL admission/claim/publish races with revoked/expired/missing grant, changed Terms/tier/rollout/scope; retention and partial stages; common daily budget; operation replay via another credential; a replay never changes original job provenance. Old worker cannot claim OAuth job; new worker finishes legacy jobs. Validate worker SQL remains Flask-independent.
- **PR-05:** desktop and mobile consent + connected-app controls, login continuation, Terms, denial, duplicate decision, stale transaction, account/key regressions and no credential-bearing analytics/traces. Backend tests can isolate UI fixtures; mocked flows are not product-client interoperability evidence.
- **PR-06:** official MCP client over real loopback HTTP and stdio; concurrent alternating users on one instance; stateless calls split across two instances; no account cache/token bleed; exchange/challenge/failure bounds; bad Origin/body; safe shutdown. Tool schemas/business results match local except setup; all existing package/MCPB checks remain green.
- **PR-07/08:** offline workflow/target/SHA/environment validation, manifest and marketplace checks, existing local plugin config snapshots, secure setup and MCPB unchanged, separate hosted identity, no credential placeholders requiring keys in hosted distribution. CI validates hosted server as well as local package on all supported platforms.
- **PR-09:** fixture/offline runner tests plus separately authorized real sandbox acceptance. Use disposable synthetic accounts/grants, trace-disabled execution, bounded writes/research and guaranteed cleanup. Record actual Codex desktop/CLI and Claude Code versions, refresh/revoke/401 behavior, tool list refresh and local fallback. Missing manual/client/load evidence blocks launch even if code tests pass.

Capacity acceptance is a controlled sandbox exercise, not a load test run by `/shard`: record a REST baseline, then an initial 5 aggregate protected requests/second for 5 minutes across enough synthetic owners to stay within existing per-user quotas, with up to 10 simultaneous calls; include gateway exchange costs, database/Redis headroom and status/error breakdown. Target less than 500 ms p95 added gateway/auth overhead against the paired REST baseline, with no cross-user leakage or quota bypass. These are proposed acceptance targets, not measured capacity promises. Unexpected 429/503 must be explained; do not exclude them to manufacture an availability pass. Historical jobs are benchmarked separately and sequentially within their real budgets. Start a beta at at most 50 explicitly allowlisted eligible accounts, and expand only after measured headroom and operator approval.

**Evidence publication contract (PR-09):** add the private application workflow `.github/workflows/hosted-mcp-oauth-evidence.yml`, manual and main-only, fixed to sandbox. It accepts full app/MCP SHAs and a bounded, already-redacted evidence manifest produced by the audit wrapper. Validate an allowlisted schema (versions, pair, check results, measured metrics, timestamps, cleanup and evidence digest); reject unknown fields, credentials, URLs with credentials and raw transcripts. Require human approval of real product-client checks through a dedicated evidence environment, and independently verify the current sandbox release/health pair with read-only platform access. A submitted `passed=true` or a fixture test alone is insufficient. Upload the validated manifest with short retention and source/workflow provenance. Never put a token, synthetic-user password, unredacted trace or request dump into workflow inputs. External production preflight checks this exact workflow's successful same-pair artifact and provenance with approved read-only access. Missing workflow/evidence/access blocks production; no weakening of core web L4 is needed.

## 10. Deployment Order

1. **Checkpoint the planning docs; provision nothing.** Future `/ship` uses this static graph. Source merges, schema promotions, infrastructure provisioning, OAuth enablement and package publication are separate actions.
2. **PR-01 schema:** merge additive migration; verify sandbox upgrade/migration checks. Obtain explicit production workflow/environment approval for the schema-only SHA and verify it there before opening dependent runtime PRs, per `migrations/README.md`. No schema downgrade in a shared environment.
3. **PR-02/03 backend with hosted flags off:** sandbox release plus normal web L4 and focused OAuth/legacy tests. OAuth protocol endpoints return unavailable safely until configured; the subscriber website and local API-key path continue. Do not treat `require_stats_api_key`'s legacy name as permission to leave hidden key-only assumptions.
4. **PR-04 worker before OAuth submission:** deploy the paired web/worker revision with old and new contracts supported; prove 5/6 worker readiness and legacy job compatibility before enabling OAuth research. A web process with new code plus an old worker is explicitly insufficient. PR-05 UI remains hidden unless OAuth availability is configured.
5. **PR-06/07 gateway configuration:** after explicit operator authorization create separate proposed `handigraphs-mcp` / `handigraphs-mcp-sandbox` Heroku apps (verify availability), attach stable domains/TLS, and configure only issuer/API endpoints, independent confidential service credential, resource URL, limits and optional observability. Gateway needs no Postgres/Redis add-ons. Install backend pepper/signing keys/issuer/audiences and service-secret hash through approved secret channels; never echo values or modify committed .env files. One Standard-1X production + Basic sandbox remains the $32/month list-price compute baseline; two production instances totals $57. No data-capacity upgrade is presumed.
6. **Hosted deployment workflows in the external repo:** sandbox auto-deploy is opt-in via an explicit repository variable and fixed target, default off while app/secrets do not exist. Production is main-only manual dispatch with exact full `mcp_sha` and `app_sha`, same-pair sandbox evidence, and a `production` environment approval. Check out the pinned source, not moving main; no caller-supplied app/command. Keep deployment separate from npm's release trigger. Verify account/domain health without invoking a protected tool anonymously.
7. **Evidence access:** the public adapter workflow's default GITHUB_TOKEN cannot read private application Actions. Preflight needs an explicitly provisioned, read-only, narrowly scoped GitHub App token/PAT for paired evidence, or must remain blocked. Do not silently fall back to a green MCP build or an operator-provided success boolean. PR-07 tests missing evidence/credential as a hard failure. The plan authorizes no new GitHub secret/token creation. Store only a redacted digest/version-pair summary in public artifacts; never private logs, account IDs or credentials.
8. **PR-08 candidate distribution, PR-09 acceptance:** validate direct-URL connections on sandbox before publishing/recommending the new hosted plugin. Keep the original `handigraphs-stats-api` plugin ID/config/stdio MCPB; add distinct `handigraphs-stats-api-hosted` entries. Do not move existing installations to OAuth. Source version presence is not a release. Record exact app/MCP SHAs, Heroku releases, client versions, worker contracts, evidence URLs/digests, cleanup, residual limits and date in private short-lived evidence.
9. **Explicit launch:** after required evidence and local UI review, operator approves production app/gateway promotions and the limited hosted cohort. Only then recommend hosted and publish/update marketplace artifacts or npm/MCPB versions through their authorized release workflow. The source of private app evidence remains the app's existing production/sandbox workflow; no weakening of L4 or production approval gates.

**Rollback:** disable new hosted authorizations/submissions and revoke or suspend hosted grants; leave local API keys usable. Drain/cancel OAuth jobs under a worker that understands 5/6 before stopping/reverting it. Roll back the gateway independently. Never roll the worker back to 1–4 while OAuth jobs are active. Leave additive schema/tombstones in place; do not clear shared Redis, force-reset branches or delete saved account objects. Repeated deployment does not rotate user credentials or issue replacement grants automatically.

## 11. Risks and Watch Items

- **Verified dependencies:** key-coupled request/capability/research code, migration split exception and distinct repo release policies are checked facts (R6). They explain the extra PR beyond the brief's initial 6–8 estimate.
- **Assumptions:** existing Postgres/Redis/worker headroom, domains/app-name availability and usable monitoring capacity are unmeasured. $32/$57 are incremental list-price scenarios, not a bill or service-level guarantee. More worker processes increase shared database demand; Essential-2 has a 40-connection plan ceiling, not 40 free slots.
- **Estimated effort:** keep a 15–25 person-day planning envelope, now spread over nine reviewable PRs. PR-02's custom exchange integration and real client acceptance are the main variance; allow 3–5 engineering weeks plus approval/release waits. Re-estimate after PR-02's contract tests and PR-09's first capacity results. Do not equate extra PRs with additional infrastructure cost.
- **Migration dependencies:** private schema verification and production promotion need authorization; without it dependent implementation pauses by repo policy. Never claim a skipped PostgreSQL test or a shared sandbox downgrade as evidence.
- **Standards/client drift:** DCR and stateless HTTP are documented supported paths, but exact product versions still need acceptance. Unsupported callbacks or client discovery must be reported and fixed/tested, not papered over with copied personal keys or permissive redirect matching. CIMD can be a separately reviewed later addition.
- **Library integration:** selecting Authlib is a design choice supported by its API docs, not proof of this application's completed PKCE/refresh/exchange implementation. Pin/test dependencies and maintain explicit RFC8693 tests; never invent native support. Keep root/deploy dependencies aligned.
- **Multi-tenant safety:** worker metadata must resolve the correct grant/owner, signing/pepper material differs by environment, public client names remain untrusted, and short-lived tokens alone do not provide revocation. Failures must not route through website-origin execution.
- **Hidden key assumptions:** scanned use sites are listed; each implementer still searches their touched call graph. A newly discovered affected file outside ownership is a plan amendment, not permission to edit a sibling's files silently.
- **Cross-repository control:** `/ship` must route explicitly, verify dependencies in both repositories and honor the adapter's manual merge/release policy. The MCP repository must receive the same planning checkpoint; neither a local source copy nor a successful app merge proves external work landed.
- **Public/private evidence:** cross-repo preflight requires approved read-only access. Public distribution metadata cannot contain private operational evidence or secrets. Logs, error handlers, browser analytics and saved traces are all credential leak surfaces to test.
- **Hosted refresh expectation:** tool definitions can stay cached in an active client conversation; skills are independently installed artifacts. Document reconnect/new-conversation behavior honestly. Keeping both plugin identities enabled can duplicate tool choices; onboarding should recommend enabling one connection at a time without silently disabling either.

## 12. Out of Scope

- Remote Claude Desktop, ChatGPT directory submission, and other clients in this first release; retain their existing local support and evaluate remote support separately.
- New subscription tiers, trials, new sports/tools, altered research limits, or relaxed Terms/ownership rules.
- Migrating all website login to OAuth, buying a new identity platform, or requiring customers to create a second identity.
- Hosting LLM reasoning, scraper execution, new research algorithms, permanent report archives, tracking activation, or bet placement.
- Reworking all twenty tool names/schemas as a prerequisite; keep previously identified contract improvements separate unless needed for reliable hosted parity.
- Automatic infrastructure provisioning, production activation, new worker scaling, or npm/MCPB publication as part of shaping or ordinary code merge.

- CIMD metadata URL fetching, arbitrary third-party confidential clients, full OpenID Connect identity issuance, device/password/implicit grants and a general-purpose token broker.
- Immediate live-chat hot reload guarantees, a complete website auth rewrite, production load tests, or purchasing identity/hosting services as part of this plan.
- A second MCP implementation in the monorepo, shared mutable per-user gateway configuration, token passthrough, hidden personal keys, or bypassing the existing research budget through a new origin/namespace.
- Updating global pipeline skills. Cross-repository routing is made explicit in this feature's graph and instructions, rather than silently changing shared agent workflows.
