# NHL brief pagination acceptance

The agreed pagination, context controls and factual availability update is merged
and verified in sandbox. This is a proposed owner acceptance of the pair below;
production requires owner-authorized merge and the native human environment gate.
It is not a new forecasting, ranking or sportsbook coverage release.

| Component | Tested revision |
| --- | --- |
| Application, contract 1.25.0 | `8f2a049b2dda36fef2ab2b583b562e5d084daac6` |
| Hosted MCP runtime | `2c7c80b3794169cc46dfecee950077bdad0ed470` |
| Catalog | `nhl-brief-pages-v1`, package/source 0.3.0 |
| Safe private observation SHA-256 | `20d7c69c5622f998ffbdfa46130a80b6ccea1c42410a6827dd67bef390e538bf` |

## Finite release behavior

Advertised `compact_v3` defaults to pregame games, with full-slate and scoped
counts. `include_context=false` omits repeated game/injury arrays intentionally.
Continuation pages default to omitted context and retain candidate report facts.
All qualifying player-market candidates are retrievable, up to twelve per page;
a dense orientation page can contain zero candidates with a continuation.
Selectors and owner are bound to a frozen 180-second snapshot, with eight recent
snapshots per owner. Expiry/cache loss requires an explicit restart. Context-free
pages must progress; complete serialized MCP results remain at most 32768 bytes.

Player injury matches are `listed`, `not_listed` or `unknown`, with independent
source and observation freshness. They are never medical clearance. Bounded
named teammate flags have omission counts and drill-down, without usage effects.
Shared game/player/statistical-outcome IDs identify related observations without
claiming numerical correlation or equivalent sportsbook settlement. Existing
price/sample gates, recent-first ranking and legacy/v2 readers are preserved.

## Live OAuth and Redis

Five fresh synthetic sandbox owners and their actual temporary key digests were
independently verified. Real Chromium 147.0.7727.15 login/consent, DCR, PKCE, state
and issuer checks preceded official SDK 1.32.1 MCP-first reads. Context and
skater-history cache misses were observed; no protected REST brief warmed them.

| Check | Observed result |
| --- | --- |
| Cold / warm samples | 5 / 15 |
| Cold p95 | 3255 ms (target below 6000) |
| Warm p95 | 729 ms (target below 2000) |
| Largest complete serialized MCP result | 28159 bytes |
| Unexpected 429 / 503 on passing cohort | 0 / 0 |
| Catalog / evidence | 24 tools; all five advertised evidence sections invocable |
| Refresh | Two rotations per owner with fresh connections |
| Revocation | Browser revoke followed by completed gateway 401 and refresh invalid_grant |
| Cleanup | Exact synthetic records removed; flags restored; journal removed |

Every live game had already started. Each hosted brief therefore correctly had
zero eligible candidates, one page and no next cursor. This run establishes
empty-slate OAuth behavior and section invocability, **not** live positive priced
pagination, foreign-owner cursor denial, exact-line/sample parity, or availability
of all evidence sections. The operator explicitly records the absent cursor
witness rather than treating an empty result as a positive isolation test.

A separate actual sandbox Redis fixture used synthetic hockey DTOs, the real
Flask/Cachelib Redis serializer and existing native Redis pools. It retrieved
19 candidates as 12+7 with omitted continuation context, denied another owner,
and verified eight-slot replacement. Only its exact private cache keys were
removed and absence verified. No account, SQL or OAuth calls were involved;
this is storage/algorithm evidence, not current-price hosted acceptance.

The first five-owner attempt on app `9803e4c1` failed all first slate reads before
cold measurements could be recorded. Cleanup and flag restoration succeeded.
Cachelib serialized the integer counter seed while Redis INCR requires a native
integer. Application PR890 replaced that counter with the existing native Redis
client's atomic INCR/initial EXPIRE, preserving serialized snapshot bodies and
the same bounds. Regressions use the actual Redis serializer. The failed attempt
remains a failed observation; the successful cohort above used the fixed pair.
The acceptance operator now reports only allowlisted status/code on a first-read
failure, with no raw body or credential trace.

## Actual Claude.ai

After refreshing the existing sandbox connector's tool catalog, Claude.ai
Opus 5.5 High visibly received all nine brief inputs and the updated description.
The original “tonight's games / top five” prompt took **one protected read**.
Claude reported 14 games, zero pregame games and zero candidates, declined to pad
five picks, and disclosed that absent scoped injury reports did not mean no one
was injured. No other connector, save, job or bet was used.

Three additional protected reads checked full-slate context, context omission
and a date-only five-row injury page. UI receipts showed two brief calls and one
injury call. Full context included 14 games and 28 team reports; context-free
output intentionally omitted those arrays while retaining scope counts. The
injury page reported five of 80 flags, no unavailable reports and a continuation.
Claude surfaced stale Makar/MacKinnon GTDs without implying medical clearance.
No payload errors, invented win probabilities or usage-effect estimates occurred.
Total: four protected reads plus one tool-schema load. The finite sandbox flag
window was stopped and restoration verified after the native test.

Current sandbox limitations remained visible: moneylines/totals had `no_fixture`,
some injury identities/importance were unresolved, and many observations were
stale. Claude's roster-memory comparisons and explanation of freshness clocks
were unverified inferences, not accepted data defects. These do not establish
production source coverage. No injury or candidate continuation was exercised
in this native session after the prescribed call budget; positive candidate
paging is covered by the separate fixtures above.

## Regression and rollout boundary

The feature's full local backend suite passed 5648 tests with 509 environment
skips before seven additional focused paging cases were added; those passed
separately. Final page/route coverage was 32 passed. The Redis fix's focused suite
passed 65 tests; both application PRs passed all required CI, sandbox deploy and
exact-SHA sandbox L4 checks. Fixed two-game/full-slate dense-context fixtures
retrieve all 19 candidates within three calls; the 19-shooter fixture needs two.
They cover exact union, owner/selectors, expiry/cache loss, byte limits, truthful
report matches, relationship IDs and unchanged ordering.

The full MCP validation profile passed on this acceptance branch: 213 tests,
two platform skips, production dependency audit zero, typecheck/build/pack,
distribution parity, MCPB check and both operator syntax checks. Runtime source
is unchanged from tested MCP `2c7c80b`; only the proposed record, historical
archive, documentation, acceptance diagnostics and gate assertions change.
Historical native versions in the owner record are retained as history, not
claimed as freshly tested clients. The preceding v2 record is preserved verbatim
in [its dated archive](owner-acceptance-2026-11-15-nhl-research-v2.json).

After owner acceptance, deploy the web backend first with its exact-SHA L4 check,
then the runtime-identical MCP commit through its native production approval.
The existing V2 eligibility flag already negotiates v3; no additional production
flag, DDL, scraper, account eligibility or quota expansion is part of this release.
Package/plugin publication and broader model/data improvements remain separate.
