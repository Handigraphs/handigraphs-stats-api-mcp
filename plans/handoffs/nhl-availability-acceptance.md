# NHL availability acceptance

Writer: Codex root, Windows desktop, sole writer. Branch
codex/nhl-availability-acceptance starts from canonical merged MCP
4a42f1a6ca5f6b50f4940206fa90ccbf0ecf95c4. Owner authorized PR62 merge and
sandbox deployment; merge verified and completed feature worktree closed clean.
Backend pair is app a9c7bd9379b1862ebf105dca58558a042ed24fdd, API1.27.0.
Its web/scrapers-web sandbox deployments and both L4 checks passed. Prior
production remains app97a8a4c9/MCP53f543f.

MCP sandbox run43765232916 is in progress. Fresh five-owner browser OAuth,
protected goalie page-size-four traversal, capped whole-snapshot paging and
actual Claude verification follow it. Credentials remain process-only; safe
reports and noncredential cleanup journals stay private. No authenticated traces.
The browser harness additionally checks client-visible game-cap schema and cap2
across continuation pages, including changed-cap rejection. These documentation-
only harness changes do not alter the accepted runtime source.

New owner acceptance and production decision must name the final tested pair;
native human MCP production approval and scrapers-web approval/cooldown remain.
No production mutation, DDL, new forecasts, package publication or gateway
implementation is part of this acceptance branch. Source and old-pair evidence
cannot stand in for new acceptance. Status: validation/deployment underway.


Sandbox deployment43765232916 and merge CI43765232828 succeeded at runtime4a42f1a.
First new cohort failed before goalie requests due to a harness TypeError: resource
metadata does not include the availability descriptor. All five owners retrieved
all73 players/eight pages (max29884 bytes); five cold/fifteen warm reads completed.
Cleanup passed. Corrected the harness to read the public pinned NHL discovery
for adaptive goalie support. No product/runtime change. That failed attempt stays
failed; a second fresh-owner run will establish remaining acceptance.


Second fresh cohort passed with cleanup:184 player-markets/73 players, all73 in8
pages for each owner, max29878 bytes; cold p952107ms/warm618ms. Page-size-four
goalies:5 games/2 pages. Cap1:5 games/5 selected/68 exclusions. Cap2 at limit3:
all10 in4 pages, maximum2/game, changed-cap denial and uncapped ranks preserved.
All five evidence sections, exact-line sample parity, cross-owner cursors, two
refresh rotations and browser revocation/completed401/invalid_grant passed.

Actual renewed Claude.ai Opus5.5 High completed7 calls (1 public descriptor,
6 protected reads), no errors/retries/writes. Visible tool schema has11 inputs.
Goalies5/2 pages at requested4; cap1 has5 distinct games; cap2 has6/10 selections
across2 pages and explicitly4 unseen; exact-line recent/season parity passed.
Finite flags/cohort windows initially reported cleanup mismatches, then a fresh
propagation check confirmed all six original flags and all three membership
removals. Journals removed, no corrective config write. Private screenshot and
chat are preserved for user review; no credentials/traces are in this repository.

Sandbox goalie slots are empty and history old. Read-only production checks
found10 current goalie observations/10 complete injury reports; the tested player
is graded throughNov14 in production versusNov7 in sandbox. This is a narrow
spot check, not certification of all production data. Public record/documents
preserve these limits and the failed initial harness attempt. Prior ranked
acceptance archived verbatim. Proposed safe observation digest:
f92bdb385abbc5e2257d42c591627ef13fedc3071d95561330caf685683693ff.
Final validation and exact-head owner acceptance/production decision remain.


Final profile after the owner-record update passed:228 tests (226 passed,2 skipped),
production audit0, typecheck/build/pack/distributions/unsigned MCPB. Owner record
parses with the unchanged canonical validator. Runtime remains identical to4a42f1a;
this acceptance branch changes only docs/plans/the proposed record and its existing
gate regression. A ready PR will expose the full reviewed candidate. No production
workflow has been dispatched, no new runtime flag remains, and no publication.
