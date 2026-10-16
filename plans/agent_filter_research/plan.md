# Agent Filter Research and Gamecenter Access — Implementation Plan

**Date:** 2026-10-16 · **Dispatch:** sequential · **PR mode:** per-shard

Source: [brief.md](brief.md). Planning does not authorize implementation or operational rollout.

## Purpose

Let a paid All Access subscriber ask their personal agent to read, create, save, and run Handigraphs filters for MLB and NHL, compare a bounded set of filter hypotheses through the existing Angles simulation services, and use structured Gamecenter matchup evidence and existing analysis to inform research. The API provides the account-owned resources and execution capabilities; the external MCP package and its agent skill provide the discoverable tools and research workflow. Users should be able to move between their agent and Handigraphs without translating rules, recreating saved filters, or confusing historical results with live tracking. These deliver the roadmap items “API v3: access your saved filters & Gamecenter research packets” and “MCP v3: new agent skill to let your agent run your filter.”

**Concrete example:** A user asks, “I want to build a SOG filter to figure out guys to bet over SOG for. Go research and test some filter ideas then come back with your results and create a filter for me.” The agent discovers NHL skater metrics, canonical units, historical coverage, supported outcomes, and execution limits. As an illustrative bounded comparison, it tests season SOG/G >= 2.5, >= 3.0, and >= 3.5, each with season TOI/G >= 18:00 (1080 canonical seconds), against Over 2.5 SOG over an available completed regular-season interval. A full 2025–26 interval is used only if discovery advertises coverage and the required execution capability; the agent does not silently shorten it. It reports every candidate's exact rule, dates, qualifying opportunities, wins/losses/pushes, sample and coverage limitations, and matching historical price coverage where available. It explains the choice, runs today's qualifiers separately, saves a new filter and an Angles idea containing the selected rule and exact test settings, and links to both. If the comparison is inconclusive, it reports that instead of inventing a winner or quietly saving an inferior substitute. These thresholds illustrate the workflow, not a proven strategy or a mandatory preset.

## Locked Product Decisions

| Decision | Value |
|---|---|
| Product boundary | Shape the API and MCP roadmap items as one end-to-end feature with separate monorepo API and external MCP deliverables. “v3” is a roadmap label; URL and package versioning are resolved during planning while preserving existing clients. |
| Entitlement | Retain API eligibility: active paid All Access, no active trial, current Terms, rollout permission, and an active key. Website eligibility does not automatically confer API eligibility. Recheck authorization on every operation. |
| Permission upgrade | Existing keys remain read-only until the account owner explicitly enables the new filter-writing and research permissions. A model cannot grant itself permissions. Retain least-privilege separation between reads, account writes, and bounded research execution; exact scope names and account UI are planning work. |
| Supported filter targets | MLB batters and starters; NHL skaters and goalies. Creation, saving, and running use the same account filter definitions as the website. Other table types are outside this release. |
| Meaning of run | Distinguish current-slate matching from historical frequency/outcome simulation. Return the resolved slate/date, season/phase, rule, and capability context. Live matches are not historical results, and neither operation starts tracking. |
| Capability discovery | Advertise support independently for saving a rule, live matching, historical frequency, historical outcomes, and compatible markets. Expose canonical metric/criterion identities, operators, splits, units, season/phase/date availability, limits, and reasons for unsupported combinations. Never infer historical support from a metric being queryable in the Stats API. |
| Shared rule semantics | Reuse the website's canonical saved-filter validation/evaluation and Angles services. Do not reinterpret a multi-criterion saved filter as the current Stats API's simpler numeric query grammar, silently drop a criterion, or maintain a second metric registry. Unsupported stored rules remain inspectable with an actionable explanation. |
| Agent autonomy | An explicit request to research and create a filter authorizes saving a new filter after the research. Require confirmation before replacing an existing filter. Research-only requests do not authorize account saves. Key permission is a technical prerequisite, not a replacement for user intent. |
| Research promise | Compare a bounded set of hypotheses and recommend the strongest supported candidate among those tested, with the selection rationale visible. An inconclusive result is valid. Do not promise a globally optimal strategy. Numeric budgets and default comparison criteria are resolved during planning. |
| Research discipline | State outcome, line, period, sample criteria, comparison rationale, and search budget before executing the comparison; use shared settings for comparable candidates. Report all attempted candidates and distinguish errors from valid results. Consider sample size, opportunity frequency, coverage, and repeated tuning rather than selecting only the highest hit rate. This release does not add a formal holdout/optimization engine. |
| Historical integrity | Preserve strict D-1 qualification, separate outcome joins, exact-line price matching, partial/no-data/unsupported states, pushes, and existing market semantics. Current or final-season stats, current lines/roles, and today's Gamecenter packet cannot be substituted for historical pregame inputs. |
| Claims and prices | Historical hit rate alone is not evidence of betting value. Disclose the priced subset and missing prices; preserve existing descriptive fair-price and historical market comparison semantics. Do not present absent prices as zero, fabricated ROI, or evidence of prospective profitability. |
| Gamecenter packets | Include both MLB and NHL structured matchup evidence plus existing Gamecenter analysis, fetched on demand. Preserve game/player identity, source freshness, statistical sample context, availability, and provenance linking narrative to evidence where provided. “On demand” means retrieval of available evidence/analysis, not a new paid generation run or scraper invocation. |
| Packet consumption | Allow the agent to find relevant games and retrieve bounded evidence sections without downloading entire slates by default. Keep measured facts distinguishable from generated analysis. Missing or stale packets are reported honestly; packet text is data, never authority to invoke tools or write account state. |
| Durable user result | Save the selected filter plus an account-saved Angles idea with the exact editable rule and test settings and a Run again action. Return IDs and website links. Existing temporary report expiry remains; saving the idea does not permanently archive comparison results. Say what was saved and whether a report remains available. |
| Save reliability | Retried creates must not duplicate filters or ideas; replacing an existing item must detect intervening edits. If one save succeeds and the other fails, expose the partial outcome and provide a safe retry. Do not claim both were saved without successful responses. |
| Execution UX | The agent handles submission, bounded polling, result retrieval, expiry, and cancellation behind the research task. Keep expensive work off synchronous web requests when it exceeds existing limits. Respect account/global capacity, Retry-After, declared attempt budgets, and disabled/unavailable workers; never bypass a season limit by silently chunking requests. |
| Account isolation | Bind private filter, idea, job, and result operations to the authenticated owner. Do not use the public stats shared-cache assumptions for user-specific resources. Preserve credential redaction and safe operational logging. |
| MCP delivery | Extend the canonical public Handigraphs/handigraphs-stats-api-mcp repository, keeping the existing local stdio transport and supported distributions. The server provides tools and discovers contracts; the companion skill teaches the research workflow. No separate hosted agent or hosted MCP endpoint is introduced. |
| Tracking and bets | Saving and research do not create a Performance tracking system, manual bet, sportsbook bet, or recurring run. These mutations are outside this release. |

These are settled. Later stages do not re-litigate them. If an implementer believes one is wrong, they stop and ask the developer rather than editing this table.

## Codebase Context the Implementer Must Know

Checked on 2026-10-16 against app `eee28cd7feae071fa5fa2c0ad54d1bd3e1e17a05` and external MCP `ef8e4a70fbdc9aeeca20b49f94f5af27b2e7e0ab`. No feature `research.md` existed. These are dated observations. New names in the design sections are **proposed**, not existing symbols.

| Verified surface | Implementation consequence |
|---|---|
| `services/stats_api_v1.py::PUBLIC_CONTRACT_VERSION` is `1.6.0`; `discovery_index` describes existing sports/resources. | Add compatible operations under `/api/v1`; roadmap v3 does not require new URLs. Bump contract/cache namespace for representation changes. |
| `services/stats_api_access.py::require_stats_api_key` sets `g.stats_api_user_id` and `g.stats_api_key_id`, and enforces eligibility, Terms and aggregate request quota. `evaluate_stats_api_access` includes effective-tier/affiliate rules. | Reuse that boundary and preserve eligibility semantics. Worker-safe policy extraction requires parity tests, not a weaker copied entitlement check. |
| `models.py::StatsApiKey` maps `public.api_keys` and has no permission field. Account operations are in `routes/stats_api_account_routes.py`. | Schema must precede scoped code. Only JWT/account auth can change key permissions. |
| `SavedFilter` maps `public.saved_filters`, with JSON criteria/sample_context, timestamps and no revision. `auth_routes.create_filter` explicitly validates sample_context but otherwise stores caller rule fields. | Existing creation is not sufficient public validation. Extract shared persistence, add strict public schemas, preserve compatible browser behavior. |
| `auth_routes.update_filter` calls `systems.sync_tracked_systems_for_saved_filter`. `systems.create_system` loads the saved filter without an explicit row lock. | An API edit must not blindly invoke tracking synchronization; guard referenced filters and serialize against enrollment/relinking. |
| `filter_evaluator.py` supplies `validate_filter_criteria`, `normalize_criteria`, `evaluate_filter`, columns and split/OR-group helpers. `stats_api_catalog.py` supplies `resolve_metric` and `normalize_metric_value`. | Native criteria are not the Stats API's five numeric query filters. Preserve grouping, supported comparisons and units through an explicit catalog-backed adapter. |
| `preview.py::evaluate_filter_preview(..., tracking=False)` supports the four targets and resolves `eastern_today()` internally. | Initial live run is today-only. Reject arbitrary dates instead of pretending the helper honors them. |
| `saved_research.py::keep/owned/recent` uses owner-scoped client UUIDs, optimistic revisions, a 100-idea cap and 64 KiB body bound. `SavedResearch` maps `public.angles_saved_research`. | Reuse its identity/retry contract and editable definitions. `savedResearchModel.js::savedIdeaBench` restores settings with `lastRun: null`, not a durable result. |
| `research_job_schemas.py::canonical_request` validates/hashes immutable requests. Current contracts: NHL 1, MLB 2; 32 KiB bodies; 86,400-second terminal retention. | Preserve existing website contracts. Add separate API-origin execution contracts so old workers cannot claim API jobs. |
| `ResearchJobStore` uses `public.angles_research_jobs` and `angles_research_workers`, one active job per owner/namespace, queue cap 50, lease 60 seconds, max attempts 2. `_entitled` is a website-tier check at claim; `_lease`/`renew` do not currently check API permissions. | Add key-bound admission and ongoing authorization explicitly. Reuse queue/lease logic, not website authorization as an API substitute. |
| `workers/research_worker.py` has two connections/process, read-only replay, five-second heartbeat and 600-second deadline. `simulation/execution.py::execute_research` returns separate frequency/outcome stages. | Reuse combined research jobs; no new queue, optimizer, synchronous season loop or executor rewrite. |
| `simulation/research_metadata.py` and `performance_tracking/nhl_research_contract.py` describe coverage and support. NHL synchronous requests cap at 31 days; background season requests at 366. | Intersect actual data coverage and worker readiness. Current dashboard metrics do not prove D-1 reconstruction support. |
| MLB `data_routes.get_mlb_gamecenter_detail` reads `mlb_data.game_insights.matchup_data_snapshot`; `mlb_research_payloads.project_gamecenter_research` enforces v2 context/citation/publication checks. | Reuse publication gates and apply public allowlists, not raw snapshot exposure. |
| NHL `hockey_routes.get_gamecenter_detail` reads `nhl_data.game_insights` and can invoke `extract_matchup_data` when its snapshot is absent. `scrapers-stats/scrapers/hockey/gamecenter_evidence.py` builds facts; nightly publication checks review evidence. | Public reads must bypass extractor fallback. Both sports' saved fact layouts differ. |
| `App.jsx` has `/account/api` and `/developers`, but no dedicated saved-filter/idea routes. `AnglesContext.openSavedResearch` already opens a saved idea in the editor. | Add small authenticated handoff routes rather than returning nonexistent links or building a second workbench. |
| MCP `src/server.ts::createServer` exposes the three stats tools plus optional local setup. `StatsApiHttpClient` in `src/http.ts` is GET-only, rejects unsafe origins/paths/redirects, bounds JSON and does not retry. | Extend typed methods without relaxing credential/URL protection; preserve old-server stats behavior. |
| External package is 0.2.7, Node >=22. CI has Ubuntu/macOS/Windows `platform-validation` plus aggregate `test-build-pack`. Its tree has no `.agents/pipeline.yml`. | Verify/onboard external settings in PR-07. App check names do not apply there. Do not call the eventual package version “v3” by assumption. |

### Read-only operational evidence and limits

- Production: API mode `all_access`, research submissions and worker enabled, one researchworker dyno. Sandbox: API mode `allowlist`, submissions disabled, worker enabled, one researchworker. Both had recent heartbeats for contracts 1 and 2. No config/dynos were changed.
- Both databases contain MLB `batter_splits_daily`, `pitcher_splits_daily`, `mlb_postseason_daily_builds` and NHL `skater_splits_daily`, `goalie_splits_daily`, `research_snapshot_builds`. NHL v2 receipts report 192 complete 2025–26 dates for each dataset. Current-season receipts cover 18 production dates through October 16 and six sandbox dates through October 4. Counts are not a row-by-row parity audit; actual execution still rechecks coverage and uses completed dates only.
- Latest inspected sandbox packets (September 30) contain MLB `mlb-gamecenter-v2` and NHL `nhl-gamecenter-v6` research. Latest production rows (October 16) contain NHL v6, but the MLB row has no `research` object. This does not prove every MLB packet lacks evidence; it proves legacy/partial handling is required.
- No user records, credentials or raw packets were exported. No protected API/MCP calls, pricing audit, source backfill, load test or write-capable acceptance happened during planning.

## Architecture

```text
User request -> local MCP tools + research skill
                       |
             key + scope + rollout checks
                       |
          /api/v1 capabilities and typed routes
           |              |                |
      shared filter/   owned research   saved Gamecenter
      idea services    jobs + worker    public projections
           |              |                |
      public account   D-1 replay and    published
      tables           separate outcomes snapshots
           \______________|________________/
                exact settings, evidence, links
                      existing Angles UI
```

## Database Design

**Proposed additive schema, PR-01 only.** Recheck the actual Alembic head (inspected latest revision `c6e472b8a901`) and existing columns before authoring. Do not alter landed revisions or scraper-owned schemas.

| Table | Proposed addition and constraint |
|---|---|
| `public.api_keys` | `permissions text[] NOT NULL DEFAULT '{}'`, constrained to optional `filters:write` and `research:run`; service rejects duplicate/unknown entries. Old/new keys have neither unless the account owner opts in. Eligible reads are implicit behind the new rollout gate. |
| `public.saved_filters` | `revision bigint NOT NULL DEFAULT 1`, positive check; PostgreSQL BEFORE UPDATE trigger increments from `OLD.revision` on every write, including legacy browser/script writes. Clients cannot set the authoritative revision. |
| `public.angles_saved_research` | Nullable `source_filter_id` FK (`ON DELETE SET NULL`) and positive-if-set `source_filter_revision bigint`; index the FK. Links record provenance; they never replace an idea's definition with a later filter. |
| New `public.api_filter_save_requests` | Composite PK `(user_id, operation_id UUID)`; user FK cascade; lowercase SHA-256 `request_hash char(64)` check; nullable filter and research FKs (`ON DELETE SET NULL`); `created_at timestamptz`. Insert with the filter/optional idea in one transaction. Keep tombstones so retries cannot recreate deleted items. Never store raw requests, reports or credentials here. |
| `public.angles_research_jobs` | `origin varchar(16) NOT NULL DEFAULT 'website'`, check `website/stats_api`; nullable indexed `api_key_id` FK (`ON DELETE SET NULL`). A deleted key leaves API origin intact and fails authorization; null key must never imply website origin. |

Enforce same-owner filter/idea links in services; FKs alone are insufficient. Create hashes bind normalized rule, name and exact optional idea settings. Same owner/operation/body returns original IDs; changed body is 409; deleted targets are 410. Initial API save budget is 100 creates/account/UTC day, checked from durable request rows under owner serialization; the existing 100-idea cap still applies. No report archive or new comparison table is added.

Validate on a disposable PostgreSQL database with baseline prerequisites/legacy rows, not shared sandbox or production: upgrade, assert defaults/constraints/FKs/idempotency/revision behavior, downgrade, upgrade. SQLite/baseline-only no-op is not proof. PR-01 cannot include backend test files under the migration-only rule; PR-02 adds the collected regression suite. Rollback of application code leaves additive schema in place. Downgrade must refuse destructive removal after adoption rather than discarding saved identities/provenance.

## Backend Implementation

All new module/route names below are **proposed**. Preserve canonical problem codes, safe errors, no-store headers, secret redaction and request quotas. Avoid nested Flask request contexts or impersonated browser JWTs.

### Access and discovery

- Add `STATS_API_AGENT_MODE=disabled|allowlist|all_access` (default disabled) and `STATS_API_AGENT_BETA_USER_IDS`, in addition to existing API gates. Do not change existing `STATS_API_MODE` to launch the extension.
- `stats_api_agent_access.py` composes key auth, feature gating and optional permission enforcement. Extract worker-safe eligibility into `stats_api_policy.py` with exact parity to existing active/effective-tier/trial/Terms/rollout rules. It must not require request context or network calls.
- `PATCH /api/account/api-keys/{id}/permissions` is owner/JWT-only and rate-limited, taking an explicit full subset of the two optional permissions. New-key creation defaults to neither. Rotation preserves permissions only when shown in its explicit confirmation. Existing/default keys must never gain access accidentally.
- Add an `agent` descriptor to public discovery. Protected `GET /api/v1/agent/capabilities?table=...` returns effective permissions, operation availability, rule schema/units, markets, coverage, dates, worker readiness, limits and reasons. Never shared-cache account-specific capabilities.
- Use one proposed `stats_api_agent_contract.py` registry for operation schemas, discovery and generated OpenAPI. Each shard exposes only implemented operations, still subject to runtime gates. Keep `/api/v1` compatible; bump `PUBLIC_CONTRACT_VERSION` on serialized changes. Add every emitted problem code and scenario in its owning shard.

### Proposed routes under `/api/v1`

| Method and path | Behavior |
|---|---|
| `GET /filters?table=&cursor=&page_size=`; `GET /filters/{id}` | Owned four-target rules, revision/ETag, unsupported diagnostics and links. Other filter targets remain outside this API release. |
| `POST /filters/validate` | Bounded pure validation with per-operation support; no save or execution. |
| `POST /filters/run` | Exactly one saved ID (optional required revision) or draft. Today-only read-only evaluation, resolved context and paginated qualifiers. |
| `POST /filters` | `filters:write`; required UUID `Idempotency-Key`; optionally pair a fully specified `research_idea` atomically. Return item IDs/revisions/links. |
| `PUT /filters/{id}` | `filters:write`; required revision `If-Match` (428 if absent, 412 if stale). Any Performance reference returns 409 `filter_used_by_tracking` and an explicit keep-copy action. No silent copy. |
| `GET /research/ideas`; `GET /research/ideas/{id}` | Existing owned ideas, source-filter linkage and truthful report retention. |
| `PUT /research/ideas/{id}` | `filters:write`; existing optimistic idea revision. Updates settings only; never changes a linked filter or result report. |
| `POST /research/jobs` | `research:run`; UUID idempotency key; exact rule or saved ID+revision, period/season/phase, market, side, line and min sample. 202 with status/result/cancel links. |
| `GET /research/jobs`; `GET /research/jobs/{id}`; `GET /research/jobs/{id}/result` | Owner-scoped recent/status/results with exact inputs, stage states and expiry. Current eligible read access suffices. |
| `POST /research/jobs/{id}/cancel` | Idempotent cancellation of owned API-origin job; `research:run` required. Website retains its existing own-job cancellation path. |
| `GET /{sport}/gamecenter?date=&cursor=&page_size=` | Bounded game descriptors, opaque game IDs and packet availability. |
| `GET /{sport}/gamecenter/{game_id}?sections=&evidence_ids=&cursor=&page_size=` | Allowlisted stored sections/evidence. Encode opaque IDs; do not parse them to invent league identities. |

No DELETE routes or arbitrary-URL proxy. Missing/unowned private objects return owner-scoped 404. Filter list defaults 25/max 100; reuse existing idea max 50. Max criteria 30; use applicable existing 32/64 KiB request bounds. Strict schemas reject unknown fields, duplicate parameters, NaN/Infinity and ambiguous selectors. Table identity cannot change on replacement. Research creation always returns both frequency and outcome stages; frequency-only new execution is deferred.

**Rules and parity:** expose native saved-filter column/split/condition/value/orGroup and supported comparison/hit-rate fields. Publish canonical metric IDs plus exact criterion units/scales using catalog/evaluator adapters. Test fraction versus percentage points, TOI seconds versus `m:ss`, cross-split grouping, unsupported `ne`, and phase semantics. Intersect historical support with reconstruction/coverage; H2H and live role/matchup support do not imply history. An unsupported stored rule remains inspectable but cannot execute under weakened semantics. Do not extend shared evaluator/scraper copies for this feature.

**Browser bridge:** PR-03 also adds owner-scoped JWT `GET /api/filters/{id}` through the shared service for the new website links, and returns additive revision metadata in existing browser filter reads. Do not make the browser store or use a personal-agent API key. Existing saved-idea JWT reads already provide the matching bridge.

**Persistence:** public services do not commit internally. Reuse `saved_research.keep` in the same transaction for paired create, validating idea settings against the selected rule. An idea freezes explicit test dates even if the original request said “last 30 days”; Run again reuses them until changed. Revision conflicts require reload/copy, not last-writer-wins. Legacy browser updates retain existing tracking synchronization. Public replacement rejects any filter referenced by a Performance system, including inactive history. Lock the saved-filter row consistently in API replacement and website system creation/relinking to prevent the enrollment race. No API code mutates tracking or ledger state.

**Live-run paging:** server returns count plus deterministic stable-ID order; cursors bind owner, rule/revision, resolved slate/context and evaluation token. Re-evaluation may change qualifiers, so expire or reject a cursor whose source/evaluation token changed; never concatenate pages from different live runs silently. Live payloads and private data use no-store; a bounded owner-specific temporary page cache is permitted only if needed to keep one run consistent.

### Research jobs, authorization and budgets

All API simulations use the existing background queue/executor, including short periods. This gives compute one admission path and avoids a synchronous-limit workaround. Preserve D-1 qualification, separate actuals and exact-line price joins, independent stage errors, pushes, coverage exclusions and 24-hour terminal retention.

Proposed starting settings: skill compares three candidates by default and at most five attempts per user-directed comparison; server allows ten newly accepted API jobs per user/UTC day across keys and namespaces, one active owner job in the existing environment queue, existing queue cap 50, max two worker attempts and 600-second deadline. Per-comparison limits are skill policy; daily/active/queue limits are server-enforced without the skill. These limits require hosted load evidence before launch, not automatic increases when tests fail. A user's smaller budget wins.

Serialize budget admission, count accepted failed/cancelled jobs, avoid double charges on same-key retry and reject before enqueue when unsupported or out of budget. Current-day accepted-job rows remain within terminal retention; count all statuses and API namespaces. Key rotation or queue changes must not reset usage. Keep ordinary API request quotas in addition. Distinguish API idempotency from website request keys while deduplicating API retries across the owner's keys.

Add API execution contracts (proposed NHL 3/MLB 4) alongside website 1/2. Old workers only claim their known contracts; API admission requires a fresh matching API-aware heartbeat. New workers recheck origin key, permission, eligibility, Terms and feature rollout at claim, renewal, stage publication and final completion. Missing/deleted/revoked keys or authorization lookup failures fail closed. Preserve website job policy. Read-only source connections stay separate from short job-state transactions.

Advertise polling at least every five seconds, increasing to fifteen seconds on unchanged long jobs and honoring longer Retry-After. Stop foreground polling after ten minutes with job ID/resume instructions; do not resubmit. MCP transport does not retry errors automatically. Ambiguous submission is resolved using the same idempotency key or recent jobs, never a new candidate. Capability availability and completed date range must be checked afresh; no silent chunking, date shortening or fallback to current/final-season values.

### Stored Gamecenter packet

Use a typed envelope: schema, sport, opaque game ID, league IDs when present, Eastern game date, publication state/time, section availability, source/statistical context, analysis and evidence IDs. Source `data_as_of` may be null; `generated_at` is not source freshness.

Whitelist nested evidence fields: stable ID, player/team identity, metric key/label/unit/value, split/window, sample size/unit, source season/phase, and bounded baseline/comparison fields. Stored quote facts may additionally expose book, market, side, exact line, price and timestamp, explicitly labeled as saved quotes. Narrative retains existing citations where available. Exclude internal schemas/table names, paths, prompts, rejected drafts, validator diagnostics, full membership arrays and generator artifacts. Never recursively copy arbitrary dictionaries.

Default sections: summary/context/availability. Details/evidence are explicit. Every citation resolves to included evidence or an exact retrieval link. Proposed byte budgets: 32 KiB default packet, 256 KiB detail/evidence page, max 100 evidence items/page. Use SQL JSON projection/source-size checks before decoding full raw snapshots. Return a precise section-too-large error for an unpageable section; never silently truncate a claim or citation.

MLB v2 preserves `project_gamecenter_research` publication/context/citation checks. NHL v6 preserves its stored review/publication mode and historical source-season labels. Legacy analysis is labeled `citation_status=unlinked`; allow only safely identifiable stored matchup facts with truthful provenance, not invented reviewed citations. Missing identity/sample evidence makes that section unavailable. Scheduled games without a stored publication report `not_published`. Never invoke extractors, AI, odds providers or fresh scraping during retrieval. If safe facts require new collection, return to shaping rather than expand scope.

## Frontend Implementation

- Extend `ApiAccessPage.jsx` with Save filters and ideas / Run historical research permissions, initially off, with explicit Save and effective rollout/usage states. Preserve reveal-once keys, max-two limit, rotation and revocation.
- Add authenticated `/research/filters/:filterId` and `/research/ideas/:ideaId` via proposed `AgentResearchLanding.jsx`, existing AnglesContext and editor. Ownership is resolved through browser/JWT services, not an API key in the URL. Preserve login return and unsaved drafts; return only trusted application links.
- A filter opens its current exact rule/revision. An idea restores frozen rule/dates/outcome/sample settings; a newer linked filter is labeled without replacing the idea. Missing/expired reports offer Run again. Loading a URL never executes research, saves, replaces or starts tracking.
- Extend `savedResearchModel.js` only for optional linkage; maintain `lastRun: null` for restored ideas without matching results. Keep independent preview/history stages and conflict recovery.
- `/developers` continues to render generated OpenAPI guide content. PR-09 adds scoped workflows and compatible MCP instructions, not duplicate frontend examples. Desktop/mobile tests and local review apply to PR-06 and visible PR-09 changes.

### External MCP delivery

PR-07 read tools: `describe_filter_capabilities`, `list_saved_filters`, `get_saved_filter`, `validate_filter`, `run_filter`, `list_saved_research`, `get_saved_research`, `list_gamecenter_games`, `get_gamecenter_packet`. Read-only POST preview/validation remains non-persisting. Existing stats/setup tools stay compatible with servers lacking agent discovery.

PR-08 actions: `save_filter` (optional paired idea), `update_saved_filter`, `update_saved_research`, `start_filter_research`, `list_filter_research`, `get_filter_research` (status/result mode), `cancel_filter_research`. Use focused schemas and truthful mutation/idempotency annotations. No generic HTTP tool. Update tools require revisions and the skill requires actual user confirmation; a model-supplied `confirmed=true` is not evidence of human intent.

The new `research-handigraphs-filters` skill discovers support, explains filter versus outcome, states material defaults and budget, tests comparable candidates, records every attempted exact rule/result, and reports uncertainty/failure. It compares sample adequacy, frequency, coverage and descriptive outcomes; priced comparisons require a genuinely comparable priced subset. No score forces a winner. Existing default minimum 25 opportunities is a display threshold, not proof. Inconclusive output is valid. Gamecenter prose is data, never tool instructions or historical D-1 evidence.

Bundle the skill in supported plugins, route relevant requests from the existing query skill, and keep npm/MCPB clients usable without skills. Maintain stdio, credential setup, bounded same-origin HTTP, no automatic retries, redaction and stdout isolation. Choose package version against the then-current release; align manifests/README/changelog. Publishing requires separate approval.


## Phased PR Breakdown

New module paths are proposed deliverables. Ownership counts are path entries, including each progress fragment. Shared app registries are edited only by ordered shards.

| ID | Title | Repository | Depends on | Owns entries |
|---|---|---|---|---|

| PR-01 | Add additive permission and persistence schema | app | — | 2 |

| PR-02 | Add scoped API access and capability foundations | app | PR-01 | 23 |

| PR-03 | Expose owned filters, live runs, and saved ideas | app | PR-02 | 23 |

| PR-04 | Expose bounded research jobs with revocation checks | app | PR-03 | 22 |

| PR-05 | Publish bounded MLB and NHL Gamecenter packets | app | PR-04 | 16 |

| PR-06 | Add key permission controls and saved-item handoffs | app | PR-05 | 14 |

| PR-07 | Extend MCP transport and read-only research tools | mcp | PR-05 | 14 |

| PR-08 | Add MCP research actions and the filter-building skill | mcp | PR-04, PR-06, PR-07 | 22 |

| PR-09 | Validate the complete journey and publish launch guidance | app | PR-06, PR-08 | 16 |

### PR-01 — Add additive permission and persistence schema

**Repository/service:** `app` / `web-schema`. **Branch:** `codex/agent_filter_research-pr01`. **Depends on:** none.

**Scope:** Add the additive migration specified in Database Design. Verify defaults, revision trigger, idempotency uniqueness and FK behavior on disposable PostgreSQL. Recheck the migration head.

**Out of scope:** No models, routes, backend test files, UI, worker changes or activation. New collected schema tests land in PR-02 because this PR must be migration-only.

**Owns:**

- `web/backend/migrations/versions/*_agent_filter_research_access.py`
- `plans/agent_filter_research/progress/PR-01.md`

**Must not touch:** `web/backend/models.py`, `web/backend/routes/**`, `web/backend/services/**`, `web/backend/tests/**`, `web/frontend/**`.

**Validation:** run the exact Testing Requirements profiles in order: `schema`.

### PR-02 — Add scoped API access and capability foundations

**Repository/service:** `app` / `web-backend`. **Branch:** `codex/agent_filter_research-pr02`. **Depends on:** PR-01.

**Scope:** Implement default-off feature rollout, optional key permissions, JWT-only permission editing, safe serialization and shared worker-safe eligibility. Add public operation schemas and protected capabilities; unfinished operations remain unavailable. Add real PostgreSQL schema regression tests and update API instructions. Preserve old stats/key behavior.

**Out of scope:** No filter/research/packet endpoints, frontend controls, MCP changes or production configuration.

**Owns:**

- `web/backend/models.py`
- `web/backend/services/stats_api_access.py`
- `web/backend/services/stats_api_agent_access.py`
- `web/backend/services/stats_api_policy.py`
- `web/backend/routes/stats_api_account_routes.py`
- `web/backend/routes/stats_api_agent_routes.py`
- `web/backend/services/stats_api_agent_contract.py`
- `web/backend/app.py`
- `web/backend/tests/test_agent_filter_schema.py`
- `web/backend/tests/services/test_stats_api_agent_access.py`
- `web/backend/tests/services/test_stats_api_startup_config.py`
- `web/backend/tests/routes/test_stats_api_account_routes.py`
- `web/backend/tests/routes/test_stats_api_agent_routes.py`
- `web/backend/services/stats_api_openapi.py`
- `web/backend/services/stats_api_v1.py`
- `web/backend/services/stats_api_problem_codes.py`
- `web/backend/tests/fixtures/stats_api_problem_scenarios.json`
- `web/backend/tests/services/test_stats_api_v1.py`
- `web/backend/tests/services/test_stats_api_problem_manifest.py`
- `AGENTS.md`
- `CLAUDE.md`
- `.agents/skills/stats-api/SKILL.md`
- `plans/agent_filter_research/progress/PR-02.md`

**Must not touch:** `web/backend/migrations/versions/**`, `web/frontend/**`, `scrapers-stats/**`, `shared/**`.

**Validation:** run the exact Testing Requirements profiles in order: `access`, `contract`, `python`, `python-lint`.

### PR-03 — Expose owned filters, live runs, and saved ideas

**Repository/service:** `app` / `web-backend`. **Branch:** `codex/agent_filter_research-pr03`. **Depends on:** PR-02.

**Scope:** Extract shared owner-scoped persistence. Add validation, pagination, today-only live runs, idempotent create with optional atomic filter/idea pairing, revision-guarded replacement and idea reads/updates. Explicitly map units. Block API replacement of any Performance-referenced filter and serialize the guard with website tracking creation/relinking. Preserve website behavior.

**Out of scope:** No historical execution, API tracking/ledger writes, new criterion semantics, packets or UI. Extraction and adapter are combined for parity and retry validation.

**Owns:**

- `web/backend/services/saved_filters.py`
- `web/backend/services/stats_api_filters.py`
- `web/backend/routes/stats_api_filter_routes.py`
- `web/backend/routes/auth_routes.py`
- `web/backend/services/saved_research.py`
- `web/backend/routes/saved_research_routes.py`
- `web/backend/services/performance_tracking/systems.py`
- `web/backend/services/stats_api_agent_contract.py`
- `web/backend/app.py`
- `web/backend/tests/services/test_stats_api_filters.py`
- `web/backend/tests/routes/test_stats_api_filter_routes.py`
- `web/backend/tests/services/test_saved_research.py`
- `web/backend/tests/routes/test_saved_research_routes.py`
- `web/backend/tests/routes/test_performance_routes.py`
- `web/backend/services/stats_api_openapi.py`
- `web/backend/services/stats_api_v1.py`
- `web/backend/services/stats_api_problem_codes.py`
- `web/backend/tests/fixtures/stats_api_problem_scenarios.json`
- `web/backend/tests/services/test_stats_api_v1.py`
- `web/backend/tests/services/test_stats_api_problem_manifest.py`
- `.agents/skills/angles-workbench/SKILL.md`
- `.agents/skills/performance-tracking/SKILL.md`
- `plans/agent_filter_research/progress/PR-03.md`

**Must not touch:** `web/backend/migrations/versions/**`, `web/backend/services/research_jobs.py`, `web/backend/workers/**`, `web/frontend/**`, `shared/**`, `scrapers-stats/**`.

**Validation:** run the exact Testing Requirements profiles in order: `filters`, `contract`, `python`, `python-lint`.

### PR-04 — Expose bounded research jobs with revocation checks

**Repository/service:** `app` / `web-backend`. **Branch:** `codex/agent_filter_research-pr04`. **Depends on:** PR-03.

**Scope:** Expose combined frequency/outcomes job submit/list/status/result/cancel. Add API execution contracts, source-key checks at claim/renewal/publication, admission limits and exact request provenance. Preserve website jobs, executor and retention. Test revocation, rolling upgrades, retries, cancellation, crashes and quotas.

**Out of scope:** No optimizer, report archive, source backfill, worker provisioning or simulation-engine rewrite. Admission and worker authorization stay together.

**Owns:**

- `web/backend/routes/stats_api_research_routes.py`
- `web/backend/services/stats_api_research.py`
- `web/backend/services/research_job_schemas.py`
- `web/backend/services/research_jobs.py`
- `web/backend/workers/research_worker.py`
- `web/backend/services/stats_api_agent_contract.py`
- `web/backend/app.py`
- `web/backend/tests/services/test_stats_api_research.py`
- `web/backend/tests/routes/test_stats_api_research_routes.py`
- `web/backend/tests/services/test_research_jobs.py`
- `web/backend/tests/workers/test_research_worker.py`
- `web/backend/services/stats_api_openapi.py`
- `web/backend/services/stats_api_v1.py`
- `web/backend/services/stats_api_problem_codes.py`
- `web/backend/tests/fixtures/stats_api_problem_scenarios.json`
- `web/backend/tests/services/test_stats_api_v1.py`
- `web/backend/tests/services/test_stats_api_problem_manifest.py`
- `AGENTS.md`
- `CLAUDE.md`
- `.agents/skills/angles-workbench/SKILL.md`
- `.agents/skills/stats-api/SKILL.md`
- `plans/agent_filter_research/progress/PR-04.md`

**Must not touch:** `web/backend/migrations/versions/**`, `web/backend/services/simulation/execution.py`, `web/backend/services/simulation/nhl.py`, `web/backend/services/simulation/historical.py`, `web/frontend/**`, `scrapers-stats/**`, `shared/**`.

**Validation:** run the exact Testing Requirements profiles in order: `research`, `contract`, `python`, `python-lint`.

### PR-05 — Publish bounded MLB and NHL Gamecenter packets

**Repository/service:** `app` / `web-backend`. **Branch:** `codex/agent_filter_research-pr05`. **Depends on:** PR-04.

**Scope:** Add date-bounded game discovery and stored section/evidence retrieval. Preserve publication gates, identity, citations, sample context and freshness through explicit allowlists. Test both sport schemas, legacy/stale/missing/withheld packets, doubleheaders, poison fields and byte bounds. Never use extractor fallback.

**Out of scope:** No scraper/generator changes, live odds refresh, model generation or historical reconstruction. Both sport projectors share one public contract.

**Owns:**

- `web/backend/services/stats_api_gamecenter.py`
- `web/backend/routes/stats_api_gamecenter_routes.py`
- `web/backend/services/mlb_research_payloads.py`
- `web/backend/services/stats_api_agent_contract.py`
- `web/backend/app.py`
- `web/backend/tests/services/test_stats_api_gamecenter.py`
- `web/backend/tests/routes/test_stats_api_gamecenter_routes.py`
- `web/backend/tests/fixtures/stats_api_gamecenter_packets.json`
- `web/backend/services/stats_api_openapi.py`
- `web/backend/services/stats_api_v1.py`
- `web/backend/services/stats_api_problem_codes.py`
- `web/backend/tests/fixtures/stats_api_problem_scenarios.json`
- `web/backend/tests/services/test_stats_api_v1.py`
- `web/backend/tests/services/test_stats_api_problem_manifest.py`
- `.agents/skills/stats-api/SKILL.md`
- `plans/agent_filter_research/progress/PR-05.md`

**Must not touch:** `web/backend/migrations/versions/**`, `web/backend/routes/data_routes.py`, `web/backend/routes/hockey_routes.py`, `web/frontend/**`, `scrapers-stats/**`, `shared/**`.

**Validation:** run the exact Testing Requirements profiles in order: `packets`, `contract`, `python-lint`.

### PR-06 — Add key permission controls and saved-item handoffs

**Repository/service:** `app` / `web-frontend`. **Branch:** `codex/agent_filter_research-pr06`. **Depends on:** PR-05.

**Scope:** Add opt-in key controls and authenticated filter/idea links into existing Angles. Preserve exact settings/drafts; explain report expiry and linked-filter revisions. No automatic run/save/track on link visit. Test desktop/mobile/login/conflicts and stop for local developer review before push.

**Out of scope:** No new research dashboard, report archive, optimizer UI, backend contracts or MCP. Developer guide is PR-09.

**Owns:**

- `web/frontend/src/components/Account/ApiAccessPage.jsx`
- `web/frontend/src/components/Workbench/AgentResearchLanding.jsx`
- `web/frontend/src/components/Workbench/agentResearchLinkModel.js`
- `web/frontend/src/components/Workbench/savedResearchModel.js`
- `web/frontend/src/components/Workbench/AngleTestDialog.jsx`
- `web/frontend/src/context/AnglesContext.jsx`
- `web/frontend/src/App.jsx`
- `web/frontend/src/config/api.js`
- `web/frontend/tests/e2e/stats-api-access.spec.ts`
- `web/frontend/tests/e2e/stats-api-agent-handoff.spec.ts`
- `web/frontend/tests/unit/agentResearchLinkModel.test.js`
- `.agents/skills/angles-workbench/SKILL.md`
- `.agents/skills/stats-api/SKILL.md`
- `plans/agent_filter_research/progress/PR-06.md`

**Must not touch:** `web/backend/**`, `scrapers-stats/**`, `shared/**`, `Handigraphs/handigraphs-stats-api-mcp/**`.

**Validation:** run the exact Testing Requirements profiles in order: `ui`.

### PR-07 — Extend MCP transport and read-only research tools

**Repository/service:** `mcp` / `mcp`. **Branch:** `codex/agent_filter_research-pr07`. **Depends on:** PR-05.

**Scope:** Verify external repo instructions and onboard if needed. Extend safe bounded HTTP to typed methods/bodies/conditional headers; preserve GET/no-retry behavior. Add discovered capability, saved-item, validation/live-run and packet read tools; no arbitrary HTTP. Test old-server compatibility and official MCP client behavior.

**Out of scope:** No save/update/job actions, workflow skill or publication. Read tools are independently useful and testable.

**Owns:**

- `.agents/pipeline.yml`
- `AGENTS.md`
- `CLAUDE.md`
- `src/http.ts`
- `src/discovery.ts`
- `src/agent-read.ts`
- `src/server.ts`
- `src/errors.ts`
- `tests/http-discovery.test.ts`
- `tests/agent-read.test.ts`
- `tests/mock-api.ts`
- `tests/mcp-tools.test.ts`
- `tests/stdio-integration.test.ts`
- `plans/agent_filter_research/progress/PR-07.md`

**Must not touch:** `plugins/**`, `mcpb/**`, `package.json`, `package-lock.json`, `src/config.ts`, `src/credentials.ts`, `src/setup.ts`, `cjbuskey/handigraphs-app/**`.

**Validation:** run the exact Testing Requirements profiles in order: `mcp`.

### PR-08 — Add MCP research actions and the filter-building skill

**Repository/service:** `mcp` / `mcp`. **Branch:** `codex/agent_filter_research-pr08`. **Depends on:** PR-04, PR-06, PR-07.

**Scope:** Add idempotent save, revision-guarded replace, job actions and truthful MCP annotations. Add the bounded research skill, explicit save/replace intent, honest abstention, unit/coverage handling and report expiry. Align manifests/version/docs and sandbox audit entry point; tools work without a skill. Actions and skill are reviewed together.

**Out of scope:** No hosted transport, scheduler, optimizer, holdout engine, tracking/bets or publication.

**Owns:**

- `src/agent-actions.ts`
- `src/server.ts`
- `tests/agent-actions.test.ts`
- `tests/mcp-tools.test.ts`
- `tests/mock-api.ts`
- `tests/stdio-integration.test.ts`
- `plugins/handigraphs-stats-api/skills/research-handigraphs-filters/SKILL.md`
- `plugins/handigraphs-stats-api/skills/research-handigraphs-filters/agents/openai.yaml`
- `plugins/handigraphs-stats-api/skills/query-handigraphs-stats/SKILL.md`
- `plugins/handigraphs-stats-api/.codex-plugin/plugin.json`
- `plugins/handigraphs-stats-api/.claude-plugin/plugin.json`
- `mcpb/manifest.json`
- `scripts/check-distributions.mjs`
- `scripts/audit-agent-sandbox.mjs`
- `package.json`
- `package-lock.json`
- `src/version.ts`
- `README.md`
- `CHANGELOG.md`
- `SECURITY.md`
- `docs/releasing.md`
- `plans/agent_filter_research/progress/PR-08.md`

**Must not touch:** `src/credentials.ts`, `src/setup.ts`, `runtime/**`, `cjbuskey/handigraphs-app/**`.

**Validation:** run the exact Testing Requirements profiles in order: `mcp`.

### PR-09 — Validate the complete journey and publish launch guidance

**Repository/service:** `app` / `web`. **Branch:** `codex/agent_filter_research-pr09`. **Depends on:** PR-06, PR-08.

**Scope:** Complete OpenAPI-owned examples and developer guide, guarded sandbox-identity acceptance, redacted evidence, exact-SHA app/MCP pairing and rollout/rollback instructions. Exercise all four targets and SOG example, parity and negative paths. Report blocked evidence honestly. Visible guide changes require local review.

**Out of scope:** No production activation, legal approval, worker scaling, data repair, publication, or mutating permanent deploy smoke.

**Owns:**

- `web/backend/scripts/audit_stats_api_agent.py`
- `web/backend/tests/scripts/test_audit_stats_api_agent.py`
- `web/backend/services/stats_api_openapi.py`
- `web/backend/services/stats_api_v1.py`
- `web/backend/services/stats_api_problem_codes.py`
- `web/backend/tests/fixtures/stats_api_problem_scenarios.json`
- `web/backend/tests/services/test_stats_api_v1.py`
- `web/backend/tests/services/test_stats_api_problem_manifest.py`
- `web/frontend/src/components/Developers/DevelopersPage.jsx`
- `web/frontend/tests/e2e/stats-api-agent-handoff.spec.ts`
- `plans/agent_filter_research/operations.md`
- `AGENTS.md`
- `CLAUDE.md`
- `.agents/skills/stats-api/SKILL.md`
- `.agents/skills/angles-workbench/SKILL.md`
- `plans/agent_filter_research/progress/PR-09.md`

**Must not touch:** `web/backend/migrations/versions/**`, `scrapers-stats/**`, `shared/**`, `Handigraphs/handigraphs-stats-api-mcp/**`.

**Validation:** run the exact Testing Requirements profiles in order: `acceptance`, `contract`, `python`, `python-lint`.

```text
PR-01 -> PR-02 -> PR-03 -> PR-04 -> PR-05
                                      +-> PR-06 --+
                                      +-> PR-07 --+-> PR-08 -> PR-09
PR-04 ---------------------------------------------> PR-08
PR-06 --------------------------------------------------------> PR-09
```

**First wave:** PR-01 only. Execute PR-01 through PR-09 sequentially in this chat. PR-06/07 are independent by repository and file ownership; no parallel sessions are requested. PR-03/04/05 are ordered because they extend the same app/capability/public-contract registries.

**PR per shard:** schema must precede code, app and MCP deploy separately, and filter/packet/read-tool increments are independently useful and testable. The shared filter-service extraction and API adapter, research admission and worker authorization, and MCP actions and workflow skill are each combined so their complete behavior can be verified.

### Repository routing and plan availability

Use state.yaml.repositories before every probe/dispatch: app is cjbuskey/handigraphs-app; mcp is Handigraphs/handigraphs-stats-api-mcp. Stock pipeline examples assume one repository, so use explicit gh --repo and the matching checkout/checks. Failed/unperformed external probes are unknown, never ready or merged. Keep the app settings snapshot; do not apply app checks to MCP. PR-07 runs onboarding if the external pipeline is still absent. Do not modify global skills for this feature.

Start each shard from its repository's verified current main after dependencies merge. Cross-repository dependencies require exact contract/source verification, not foreign Git merges. Before the plan reaches that repo's main, commit identical brief.md, plan.md and state.yaml copies as the shard's first documentation commit and record the source checkpoint. PR-07 carries the bundle to the external repo. Only progress/PR-NN.md records each shard's progress; no mutable status belongs in state.yaml. This planning task opens no plan PR and starts no implementation.

## Testing Requirements

Profiles below are exact commands referenced by each shard and copied into state.yaml. New test names are deliverables of the owning shard. Use sandbox/disposable local setup, never production. Missing required credentials or PostgreSQL coverage must be skipped/blocked visibly, not passed. Preserve unique Python test basenames across all collected test roots. The pipeline's root python profile runs the full suite for cross-cutting auth/model/app-registration and worker changes.

PR-01 is migration-only. Its existing schema tests, migration-diff and actual disposable-PostgreSQL upgrade/downgrade/upgrade must cover baseline tables, legacy rows and all assertions in Database Design. A SQLite/baseline-only no-op is insufficient. New collected schema tests land in PR-02 because migration-diff rejects non-migration backend files. Follow web/backend/migrations/README.md's loopback-only ANGLES_MIGRATION_TEST_ADMIN_URL fixture convention.

```powershell
# DATABASE_URL must point only to the disposable migration-validation database.
Push-Location web/backend
try {
  & ../../venv/Scripts/flask.exe db upgrade
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  # Execute the schema/default/FK/revision/idempotency assertions in Database Design.
  & ../../venv/Scripts/flask.exe db downgrade -1
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  & ../../venv/Scripts/flask.exe db upgrade
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally { Pop-Location }
```


### `web-frontend`

```powershell
cd web/frontend && npm run lint && npm run build
```

### `python`

```powershell
venv/Scripts/python.exe -m pytest
```

### `python-lint`

```powershell
ruff check web/backend scrapers-stats/scrapers scrapers-web shared
```

### `schema`

```powershell
$env:PYTHONPATH = "$PWD/web/backend;$PWD"
& ./venv/Scripts/python.exe -m pytest web/backend/tests/test_migrations.py web/backend/tests/test_stats_api_migration.py -q
# Also require the disposable PostgreSQL round-trip/assertions and migration-diff in plan.md.
```

### `access`

```powershell
$env:PYTHONPATH = "$PWD/web/backend;$PWD"
& ./venv/Scripts/python.exe -m pytest web/backend/tests/test_agent_filter_schema.py web/backend/tests/services/test_stats_api_agent_access.py web/backend/tests/services/test_stats_api_startup_config.py web/backend/tests/routes/test_stats_api_account_routes.py web/backend/tests/routes/test_stats_api_agent_routes.py -q
```

### `filters`

```powershell
$env:PYTHONPATH = "$PWD/web/backend;$PWD"
& ./venv/Scripts/python.exe -m pytest web/backend/tests/services/test_stats_api_filters.py web/backend/tests/routes/test_stats_api_filter_routes.py web/backend/tests/services/test_saved_research.py web/backend/tests/routes/test_saved_research_routes.py web/backend/tests/routes/test_performance_routes.py -q
```

### `research`

```powershell
$env:PYTHONPATH = "$PWD/web/backend;$PWD"
& ./venv/Scripts/python.exe -m pytest web/backend/tests/services/test_stats_api_research.py web/backend/tests/routes/test_stats_api_research_routes.py web/backend/tests/services/test_research_jobs.py web/backend/tests/workers/test_research_worker.py web/backend/tests/services/simulation -q
```

### `packets`

```powershell
$env:PYTHONPATH = "$PWD/web/backend;$PWD"
& ./venv/Scripts/python.exe -m pytest web/backend/tests/services/test_stats_api_gamecenter.py web/backend/tests/routes/test_stats_api_gamecenter_routes.py web/backend/tests/routes/test_mlb_gamecenter_freshness.py web/backend/tests/routes/test_hockey_gamecenter_coverage.py web/backend/tests/routes/test_hockey_gamecenter_quotes.py -q
```

### `contract`

```powershell
$env:PYTHONPATH = "$PWD/web/backend;$PWD"
& ./venv/Scripts/python.exe -m pytest web/backend/tests/services/test_stats_api_v1.py web/backend/tests/routes/test_stats_api_v1_routes.py web/backend/tests/services/test_stats_api_problem_manifest.py web/backend/tests/routes/test_stats_api_agent_discovery_routes.py -q
```

### `ui`

```powershell
node --test web/frontend/tests/unit/agentResearchLinkModel.test.js
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
npm --prefix web/frontend run lint
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
npm --prefix web/frontend run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Push-Location web/frontend
try { npx playwright test tests/e2e/stats-api-access.spec.ts tests/e2e/stats-api-agent-handoff.spec.ts tests/e2e/angles-generalize.spec.ts --project=desktop --project=mobile } finally { Pop-Location }
```

### `mcp`

```powershell
# Run in the external MCP shard worktree using Node 22.
npm ci
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
foreach ($script in @('test','audit:prod','typecheck','build','pack:check','distributions:check','mcpb:check')) {
  npm run $script
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
```

### `acceptance`

```powershell
$env:PYTHONPATH = "$PWD/web/backend;$PWD"
& ./venv/Scripts/python.exe -m pytest web/backend/tests/scripts/test_audit_stats_api_agent.py -q
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
npm --prefix web/frontend run lint
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
npm --prefix web/frontend run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Push-Location web/frontend
try { npx playwright test tests/e2e/stats-api-agent-handoff.spec.ts tests/e2e/stats-api-access.spec.ts --project=desktop --project=mobile } finally { Pop-Location }
```

### Required behavioral evidence

- **PR-02:** old keys remain read-only; explicit scope choices; trial/expired/revoked/nonallowlisted/current-Terms failures; JWT-only permission editing with owner checks; usage telemetry failure does not disable management. Real PostgreSQL tests prove schema/trigger behavior and old-writer compatibility.
- **PR-03:** all four targets match supported website rule/evaluation semantics, including percent/time conversions and cross-split/OR/comparison cases. Cover owner isolation, unsupported/no-data versus zero, cursor binding, stale revisions, duplicate/response-lost retries, tombstones, pair-save rollback, and concurrent tracked-filter enrollment. No API write produces tracking versions or ledger entries.
- **PR-04:** D-1 integrity and exact input/result association; no source/ledger writes; independent stages; revocation during queued/running work; old/new-worker compatibility; quotas across keys/namespaces; cancelled/failed attempts; retries without double charge; expiry, lease/crash and cancellation recovery. Website job authorization is unchanged.
- **PR-05:** versioned and legacy packets for both sports, absent snapshots, withheld/stale/partial sections, identity/doubleheaders, citation closure, quote timestamps, nested poison-field redaction and byte bounds. Verify no extractor or generation callback is invoked.
- **PR-06:** desktop/mobile permissions, link/login return, unowned/deleted objects, exact settings restore, changed linked-filter revision, preserved draft, expired report and no implicit run/save/track. Run the new link-model unit test as well as UI profiles.
- **PR-07/08:** official MCP client with mocked upstream; old-server compatibility; no bearer forwarding to redirects/foreign origins/unsafe paths; method/body/header allowlists; safe 400/401/403/409/410/412/428/429/503 responses; no automatic retries; annotations, byte bounds, redaction and stdout isolation. Scenario checks: SOG worked example, rerun, replace requiring confirmation, unsupported H2H history, zero qualifiers, inconclusive comparison, interrupted polling and malicious packet instructions.
- **PR-09:** use a disposable eligible sandbox identity and temporary key already in `HANDIGRAPHS_API_KEY`. The auditor defaults to read-only discovery/contract checks; writes require `--confirm-account-writes`, fixed sandbox target and synthetic-identity verification. Track created IDs and clean only those synthetic filters/ideas/jobs via a sandbox-only operator path, then revoke the temporary key; report cleanup failures. Never add public DELETE or use an ordinary subscriber's records. Disable authenticated traces/screenshots/video. Permanent nine-resource deploy smoke stays read-only with its existing dedicated key.

Proposed live commands, delivered by PR-09 and PR-08 respectively:

```powershell
# App worktree; refuses production and reads credentials only from environment.
& ./venv/Scripts/python.exe web/backend/scripts/audit_stats_api_agent.py --target sandbox --confirm-account-writes
# External MCP worktree; same sandbox-only and synthetic-account rules.
node scripts/audit-agent-sandbox.mjs --confirm-account-writes
```

Run only after temporary identity, allowlist, API-aware worker contracts and source coverage are ready. These commands do not exist yet and were not run during planning. No implementation tests are claimed by this document.

## Deployment Order

1. **PR-01 schema:** disposable PostgreSQL and migration-diff before merge/deploy to sandbox. Before dependent production application code, obtain the normal explicit production workflow/environment approval for the migration-only revision. Production deploys all current main: promote the migration before dependent code lands, or establish an explicitly reviewed exact-SHA deployment path. Do not describe a later main release containing dependent code as schema-only. This is an operator gate before PR-02, not automatic permission to deploy.
2. **PR-02–05 backend:** merge in order with new agent mode absent/disabled. Preserve current Stats API and website research configuration. Sandbox feature allowlisting/submission enablement needs explicit operator authorization and restoration of prior settings. Old stats behavior remains usable throughout.
3. **Worker compatibility:** deploy authorization-aware workers before API-origin admission. Require fresh matching API contracts 3/4, storage readiness and hosted revocation/load evidence. Current website contracts 1/2 do not satisfy that gate. No provisioning/scale change is implied.
4. **PR-06 UI:** local backend 5001/frontend 5173 against sandbox; explicit local approval before push/Ready PR. UI visibility is not a security gate. The same applies to visible developer-guide work in PR-09. Other shards skip the frontend stop and open Ready under repo rules; Draft only if requested.
5. **PR-07/08 MCP:** merge against verified compatible API contracts; keep existing tools functional with older servers. Complete all three OS and distribution checks. npm/plugin/MCPB publication is a separate approved release, after compatible production behavior or a clearly documented unavailable response.
6. **PR-09 evidence:** exact app/MCP SHAs, temporary sandbox identities, four-target parity and full SOG journey. Current sandbox source dates are stale relative to production; use honestly advertised completed-season data or separately approve sandbox refresh. Verify legacy MLB behavior and missing-price semantics. Obtain any required Terms review before opt-in permissions become public.
7. **Controlled production launch:** separately approve deploy/environment gate and new-feature allowlist, then broad enablement only after bounded live evidence. Leave existing Stats API rollout unchanged. Record workload headroom, compatible versions, cleanup and rollback criteria. No automatic deploy, production write or npm publication is authorized by the plan.
8. **Rollback:** disable new agent-feature mode and admissions; authorization-aware workers stop affected API work. Preserve website research when safe and keep additive schema, save tombstones and owned filters/ideas. Do not drop data or shut down unrelated website research merely to disable API access. Published MCP versions should return actionable unavailable responses.

## Risks and Watch Items

- Receipt counts are not snapshot parity, price coverage or predictive validity. Actual simulations must still inspect source coverage and use strict pregame data. No current-season/postseason availability is promised solely by this feature.
- Production's newest inspected MLB row lacks versioned research. Preserve legacy limitations; new data collection would require returning to shaping, not quietly changing PR-05.
- Key permissions checked only at submission are insufficient. Cover deletion, Terms/rollout changes, lease renewal and rolling worker releases; fail closed when authorization cannot be read.
- Any Performance-referenced filter is protected from API replacement, including inactive history. Shared row locking is required to prevent enrollment races. The explicit alternative is a new filter copy.
- Native criteria, public metric fractions, NHL clock values and historical scope differ. Preserve units and fail unsupported combinations rather than infer equivalents.
- Saved settings outlive temporary results. A rerun after corrected source data may differ; neither link provenance nor a saved idea guarantees a permanent/reproducible report.
- Proposed quotas are not performance evidence. Keep feature disabled if hosted tests do not justify them; do not raise global concurrency or permit synchronous loops to make tests pass.
- Schema-first deployment is a real main-promotion constraint. Check it before opening dependent code, while the migration-only revision is still promotable.
- Cross-repository routing is mandatory because stock skill examples assume one repo. Missing external probes are unknown. External Dependabot PRs #22/#17/#16 were open during inspection; refresh/reconcile source and locks without assuming their writers idle.
- The docs worktree's smoke runtime could not start Vite/Flask. The user authorized a docs-only skip; implementation still requires normal setup and checks. Do not carry this exception into code PRs.
- Live flags/heartbeats/receipt evidence is dated October 16 and must be rechecked before operations. No protected real-user key was used during planning.
- PR-02/03/04 touch several shared contract/tests files but form coherent security/persistence boundaries. Keep them ordered, avoid unrelated refactors and split only if an independently verifiable safety boundary emerges.


## Out of Scope

- Team, bullpen, and reliever filter authoring/research in this release; the four player targets provide the bounded initial scope.
- Formal automated optimization, exhaustive search, new holdout/baseline engines, and claims of a globally optimal or profitable filter.
- Permanent archives of research/comparison reports. Keep editable ideas and exact settings; respect current report expiry.
- API deletion of filters/ideas, automated tracking enrollment, manual-bet writes, sportsbook execution, recurring monitoring, and unattended scheduled research.
- New sports, new historical metric/split reconstruction, broad data backfills, or invented fallback data. Expose existing supported capabilities honestly.
- On-demand Gamecenter AI regeneration or scraping. Retrieve existing published analysis/evidence only.
- Hosted MCP transport, OAuth, a hosted research agent, and a new subscription tier.
- Production rollout, worker provisioning, configuration, Terms approval, deployments, npm publication, or other operational changes. This brief authorizes none of those actions.

Additional deferrals: standalone frequency-only API execution, arbitrary-date live previews, global pipeline refactors and automatic permission grants. Season/phase availability stays capability-driven, not guaranteed by the roadmap label.
