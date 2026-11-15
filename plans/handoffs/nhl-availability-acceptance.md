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
