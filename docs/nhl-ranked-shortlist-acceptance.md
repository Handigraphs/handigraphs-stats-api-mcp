# NHL ranked shortlist acceptance

This records a bounded descriptive-screening release, not a forecast or betting
value model. Production still requires the owner's exact-pair decision and the
native GitHub production environment approval.

| Component | Tested source |
| --- | --- |
| Application, API1.26.0 | `97a8a4c9221238efa79903f56f6b09da9f0c1fec` |
| Hosted MCP | `0422559edf191806ce3854201fa2494af25573ef` |
| Catalog | `nhl-ranked-shortlist-v1`, source/package0.3.0 |
| Private safe observation SHA-256 | `511bde3e57df6fdaf4624d413301e98f691724a1d116cc18d67938b0f9ab017c` |

## Finite contract

Advertised compact_v4 view=shortlist ranks the entire covered eligible
player-market pool by exact season observed-rate gap above quoted break-even,
with descriptive deterministic tie breaks and one market per player globally.
Its first page defaults context-light. Alternative keys remain visible; research
view retains round-robin access to every qualified alternative. Ranking scope and
pool/unique counts prevent a partial source pool from masquerading as complete.
Ranks and candidates remain frozen in the existing180-second/eight-slot snapshots.
Complete serialized brief results remain at most32768 bytes.

Every page includes the shared team contexts referenced by its candidates.
Resolved-entry matching is separate from unresolved names and source freshness;
unknown identity coverage never becomes medical clearance or a usage estimate.
Current stored Gamecenter prices are independent annotations. They do not rewrite
accepted prose, evidence dependencies, publication clocks or frozen citation
cursor identities. Missing/stale/started/unsupported prices remain explicit.

## Live sandbox inputs and OAuth

App PR891 passed required CI, sandbox deploy43728367613 and exact-SHA
L4 43728703030. Owner-approved MCP PR60 passed all platform CI, merged to the
tested revision and deployed in sandbox43747820170.

Sandbox had no current-day lineups or projected starters. A finite current-day
production-source mirror inserted280 missing line slots and5 projected-goalie
matchups into sandbox. Both database identities and schemas were verified;
production transactions were read-only. One sandbox transaction inserted only
missing natural keys, without DDL, deletes, existing-row overwrites or tomorrow's
data. Exact rows and original source timestamps were verified after insertion.
This establishes application acceptance with mirrored real source rows, not an
independently refreshed sandbox ingestion pipeline.

Five fresh synthetic owners used real Chromium login/consent, DCR, PKCE, state
and issuer checks, then fresh official SDK1.32.1 connections. Actual context and
skater-history misses establish cold/coalesced reads; there was no protected REST
brief warm-up. Discovery reported API1.26/catalog support and all five invocable
evidence sections. Its safe build_sha was null; the exact deployed source is bound
by the successful exact-SHA deployment workflow, not inferred from that null.

| Check | Observed result |
| --- | --- |
| Cold / warm samples |5 /15 |
| Cold p95 |3590ms, target below6000 |
| Warm p95 |602ms, target below2000 |
| First protected read |Ten distinct players, at most28718 bytes |
| Covered qualified pool |169 player-market selections /63 unique players |
| Full retrieval |All63 players across7 pages for every owner |
| Maximum complete result, all pages |28805 bytes |
| Cross-owner cursor |Denied for every owner |
| Evidence |All five sections invoked; exact-line/recent/season sample parity |
| Refresh/revocation |Two rotations per owner; browser revoke then gateway401 and invalid_grant |
| Cleanup |Synthetic owners/registrations/credentials removed; cohorts/flags restored |

The selected current Gamecenter packet had no published watches. Its independent
sidecar correctly returned unavailable/no_published_watches. This live run does
not establish positive published-watch quote joins; exact current line/book/
price, identity ambiguity, stale/started prices and source failure are covered
by fixtures. Saves were excluded without a fresh confirmed starter observation,
even though projected rows were present; no confirmation was manufactured.

## Positive storage and local regression evidence

The actual sandbox Redis fixture used synthetic140-selection/20-player DTOs and
the real Cachelib/native Redis storage paths. It returned the correct top ten
in19276 bytes, then ten disjoint players with global ranks11..20; page-local team
references, foreign-owner denial and eight-slot replacement passed. Exact finite
keys were removed and cleanup verified. Its first attempt lacked an isolated
cursor-signing setting; that failed attempt remains failed, and the corrected
process-only synthetic setting passed. This is storage evidence, not live pricing.

The full backend suite passed5668 tests/520 environment skips;22 focused cases
passed again after the final assertion. Changed Python Ruff passed. The dense
14-game oracle still returns the actual top ten from140 selections in one result.
The full MCP profile passed221 tests/2 platform skips, production audit zero,
typecheck/build/pack/distributions/unsigned MCPB and skill validation. Backend and
MCP source PRs passed required CI. No generation, new feed provider, forecast,
eligibility expansion, DDL or package publication is part of this code change.

## Actual Claude.ai

An expired existing sandbox login was refreshed in the task-owned
tab. The user signed in and confirmed the current API Terms. Their exact All
Access sandbox account received finite test-cohort membership, with read-only
consent and optional save/research permissions unchecked. The refreshed catalog
visibly exposes ten brief inputs including view, nine Gamecenter inputs including
current offers, and the new workflow descriptions.

Claude.ai Opus5.5 High used exactly three protected reads: one shortlist request
with candidate_limit10/view=shortlist, one exact-line season-inclusive evidence
request for the first candidate, and one compact Gamecenter request with current
offers. The brief returned the full top ten from169 qualified rows/63 players;
five games were pregame, and no byte limit applied. Claude retained the supplied
ranks, checked descending season-gap order and break-even arithmetic, and did
not browse partial research pages to select its ten. The first candidate's
recent/season counts and quote matched the exact-line evidence call.

The current Gamecenter packet was not published; no watches or prices were
invented. All eight candidate team injury contexts were unavailable with unknown
matching/freshness. Claude explicitly refused to interpret that as clearance,
noted overlapping small samples and unknown statistics source times, and reported
history ending November7/8. The history-age claim was not independently checked
against complete box scores in this native run; current production input completeness
is not certified by the test. It did not make a model probability or value claim.
No size/catalog error, automatic retry, save, job, bet, other connector or web
search occurred. The user-visible final result and scoped tool receipts were
observed; a private screenshot is retained.

The finite flag window and temporary owner membership were stopped. Immediate
post-write configuration reads initially reported restoration false. A subsequent
read-only recheck verified every original feature flag and absence of this owner
from all three temporary memberships; no additional mutation was needed. A
separate successful verification record preserves that distinction, and both
recovery journals were removed. The user-authorized Terms acceptance and read-only
connector refresh remain; no customer account or source grant was deleted.

## Rollout boundary

A proposed new owner record follows the native check and verified flag/cohort
restoration. The prior acceptance is preserved verbatim in its dated archive. Native
client versions in that record remain historical; this incremental release tests
SDK/Chromium and Claude.ai, not every historical native client. After the owner's
record/merge decision, deploy web first through its exact-SHA L4 preflight, then
the runtime-identical MCP through native human approval. Existing eligible-user
V2 negotiation advertises V4; no additional production flag is introduced.
