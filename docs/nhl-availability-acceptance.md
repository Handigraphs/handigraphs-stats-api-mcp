# NHL availability and game-cap acceptance

This bounded follow-up repairs a documented goalie size failure, adds optional
shortlist concentration controls and improves future injury identity captures.
It changes no prediction model. Production still requires the owner's exact-pair
decision and native GitHub production approval.

| Component | Tested source |
| --- | --- |
| Application, API1.27.0 | `a9c7bd9379b1862ebf105dca58558a042ed24fdd` |
| Hosted MCP runtime | `4a42f1a6ca5f6b50f4940206fa90ccbf0ecf95c4` |
| Catalog | `nhl-availability-caps-v1`, source/package0.3.0 |
| Private safe observation SHA-256 | `f92bdb385abbc5e2257d42c591627ef13fedc3071d95561330caf685683693ff` |

## Finite contract

Advertised adaptive goalie pagination fits whole games within the existing
3584-byte bound, keeps requested page_size in cursor scope and advances by
actual returned games. Coverage reports actual counts and byte limiting.
An intrinsically oversized single game still fails explicitly. There is one
protected GET per page, without retries or per-player HTTP fan-out.

Optional max_candidates_per_game1..12 applies only to explicit v4 shortlist.
It limits the whole frozen list after global player dedup and before pagination;
the default stays uncapped. Selected rank and uncapped pool_rank remain distinct.
Original population and cap exclusions are explicit. Cap is cursor-bound; price,
sample and descriptive season-gap ranking rules remain unchanged. Requested
candidate counts are upper bounds; existing byte limits and continuations remain.

Future injury captures may bridge a missing provider ID using a unique normalized
exact name on the canonical current team, including goalies and injured players.
Wrong-team, duplicate or conflicting provider identities stay unresolved. The
fallback never assigns permanent provider IDs, rewrites older observations,
invents freshness or certifies medical clearance. Packet schedule/publication
handles remain opaque; cross-tool joins use league_game_id. Published content and
complete citation dependencies remain unchanged.

## Source and storage validation

Backend PR892 passed required CI, web sandbox deploy43764036838 and scrapers-web
sandbox deploy43764036782. Their exact-SHA post-deploy checks43764365496 and
43764231415 passed, including core Playwright and trace-disabled API smoke.
The owner approved MCP PR62 at its exact head; it merged to the tested runtime,
passed all platform CI and deployed in sandbox43765232916.

Root pytest passed5686 tests with521 optional/environment skips. Separate
disposable PostgreSQL injury capture tests passed all10 cases, including real
fallback SQL and unchanged canonical provider IDs. Changed Python Ruff passed.
MCP validation passed226 tests with2 intentional skips, production audit zero,
typecheck/build/pack/distributions/unsigned MCPB and shared skill validation.

Read-only live canonical-roster checks resolved the three verified absent
provider bridges in both sandbox and production. A bounded normal sandbox source
capture for those three teams wrote four reports with ten resolved stored flags,
preserving original source update and observation timestamps. No production,
lineup, provider-ID or schema writes occurred. No new lineup mirror was performed
for this follow-up; this does not certify sandbox ingestion for every dataset.

A separate real sandbox Redis synthetic fixture used140 player-market rows and
20 unique players across five games. The uncapped top ten was correct in20040
complete-MCP bytes. Cap2 selected the expected ten across four pages, max9273
bytes, preserving uncapped positions. Changed-cap/foreign-owner denial and
eight-slot replacement passed; every finite isolated key was removed and cleanup
verified. This is storage evidence, not live pricing or OAuth evidence.

## Fresh OAuth acceptance

Five fresh synthetic owners used actual Chromium login and consent, DCR, PKCE,
state and issuer checks, then fresh SDK1.32.1 connections. The first protected
slate calls were not REST-warmed; actual context and skater-history misses prove
cold/coalesced reads. Client-visible schemas include the game cap. Runtime build
SHA remains null in discovery, so the successful exact-SHA deployment binds the
runtime; that null is not relabeled as a build identity.

| Check | Observed result |
| --- | --- |
| Cold / warm samples |5 /15 |
| Cold p95 |2107ms, target below6000 |
| Warm p95 |618ms, target below2000 |
| First-page maximum |29368 complete-MCP bytes; ten unique players |
| Covered pool |184 player-market selections /73 unique players |
| Full retrieval, each owner |All73 players across8 pages |
| All-page maximum |29878 complete-MCP bytes |
| Goalie requested page_size4 |All5 games across2 pages, no413 |
| Whole-list cap1 |5 games/5 candidates,68 exclusions from73 unique players |
| Whole-list cap2, page limit3 |All10 candidates across4 pages; maximum2/game |
| Ranks and cursors |Selected/uncapped order preserved; changed cap/foreign owner denied |
| Evidence |All5 advertised sections invoked; exact-line recent/season sample parity |
| Refresh/revocation |2 rotations/owner; browser revoke then completed gateway401 and invalid_grant |
| Cleanup |All5 synthetic identities/registrations/credentials removed; cohorts/flags restored |

The first attempt failed before goalie requests due to an acceptance-harness
TypeError: resource description does not contain the availability descriptor.
All five owners had retrieved the complete pool; cleanup passed. The harness now
reads pinned public NHL discovery. That attempt remains failed; the successful
second attempt used five new owners after natural cache expiry. No runtime
change, protected-error retry or Redis clearing converted the failed run.

The selected current Gamecenter packet had no published watches and correctly
returned unavailable/no_published_watches. This follow-up adds no positive live
watch-price-join evidence or new Gamecenter review/generation acceptance.
Unknown statistical source times, older histories, incomplete injury coverage
outside the bounded capture and stale source timestamps remain limitations.

## Actual Claude.ai

The existing sandbox connection was renewed with required read scope only, no
new Terms or optional permissions. Its visible catalog refreshed from ten to
eleven brief inputs, including max_candidates_per_game and updated goalie
upper-bound guidance. Actual Claude.ai Opus5.5 High completed seven calls:one
public resource descriptor and six protected reads, no errors, retries, writes,
saves, research jobs or bets. Read requests were allowed once; persistent tool
permissions were unchanged.

It retrieved all five goalie games in two pages at page_size4, selected five
distinct games with cap1 and preserved selected/uncapped ranks. With cap2/limit3,
it retrieved six of ten selections across two pages, correctly disclosing four
unseen candidates. Exact-line recent/season sample parity passed. Separate
snapshots changed with new quotes; that was disclosed, while continuation order
and cap remained fixed within each snapshot.

Sandbox starter slots were empty, four of five candidate-team injury reports
were unavailable, and the tested evidence history ended November7. These are
coverage limits, not zero-valued observations or medical clearance. Follow-up
read-only checks found production's same player/market history graded through
November14 (21 appearances versus sandbox18), plus ten current production goalie
observations and ten complete injury reports. Both databases contain box scores
through November14; that alone does not establish player-history completeness.
This narrow production spot check does not certify all production data.

Both finite native-test windows initially reported restoration mismatches. A
fresh read after configuration propagation verified all six flags equal their
original values and the temporary owner absent from all three added cohorts;
noncredential recovery journals were then removed. No corrective config write
was necessary. The renewed existing read-only connector remains installed.
No temporary account, test key, cohort membership or flag change remains.

The safe observation digest above binds these aggregates, the successful cohort,
source-date checks and cleanup. Private conversations, screenshots, credentials
and authenticated traces are not included in this public repository. The current
owner record is proposed for explicit owner acceptance; prior ranked-shortlist
acceptance is preserved verbatim in its dated historical record. Production
requires owner-authorized merge, exact-SHA validation and native human approval.
