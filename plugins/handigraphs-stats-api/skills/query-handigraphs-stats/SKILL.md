---
name: query-handigraphs-stats
description: Use the Handigraphs Stats API MCP tools to discover and query live MLB or NHL statistics. Trigger for player or team stat lookups, matchup comparisons, supported metric or split discovery, filtered rankings, pagination, and interpretation of Handigraphs performance tiers or sample qualification.
---

# Query Handigraphs Stats

## Connection

Use this plugin's local `handigraphs-stats` server. Never switch to a different
connection or account without the user's choice. Never ask for or repeat a Stats API key in chat.
If the local server is not configured, invoke the bundled
`setup-handigraphs-stats-api` skill and follow its platform-specific masked setup
workflow. Do not accept the key as a tool argument or automate entry into the
setup window. Local keys and hosted grants are separate; revoking a hosted
connection does not rotate or revoke a local key.

## Shared business workflow

For broad NHL slate requests, inspect `slate_brief` in fresh resource discovery.
When enabled, start `get_slate_brief` with an explicit Eastern date and sport `nhl`.
For a top N request, use advertised compact_v4 view=shortlist and candidate_limit=N.
It ranks the entire covered eligible pool by season observed-rate minus quoted
break-even before paging, choosing one market per player globally. Read global
rank, pool/unique counts and source_coverage; partial sources still limit the pool.
Shortlist defaults context-light. Flat ordered candidates reference team_contexts
included on that same page, so no prior response is needed to read team facts.
matched_known_entry concerns resolved report entries; overall unknown remains
when identities are unresolved. Neither field establishes medical clearance.
candidate_limit is an upper bound. Check coverage.returned, byte_limited and
remaining; follow next_cursor with unchanged selectors, including any game cap.
When advertised, max_candidates_per_game (1..12) optionally limits the whole
shortlist after global player dedup; default uncapped. rank is selected order;
pool_rank retains uncapped position. This controls concentration, not correlation
or risk, and can return fewer than requested even with a larger uncapped pool.
Research view keeps round-robin browsing and alternative markets. Never describe
five items from partial unranked research pages as the full-pool top five.
It supports today and regular season only. Advertised compact_v3 defaults to
pregame context; follow next_cursor with identical selection controls. Continuations
omit repeated context by default; include_context=false also supports an initial
context-light read. pregame_only=false includes the full slate with scope counts.
Every eligible player-market selection is pageable, with one/player/page. Snapshots
expire180s/eight newer owner snapshots; restart explicitly after expiry/cache loss.
Injury listed/not_listed/unknown is a report match with separate freshness, never
medical clearance. Named teammate flags are facts, not usage-impact estimates.
Shared game/player/statistical-outcome IDs help compare pages/calls, without
correlation estimates or bookmaker settlement equivalence. Retain status_at_read
for started/stale snapshot quotes; refresh source evidence before using a price.
Older APIs retain compact_v2/legacy. V2 and V3 keep odds -250 through +300, at least 8/10 graded
skater games or five goalie starts, recent observed rate at least break-even
plus 10 percentage points and an overlapping season baseline at least break-even
(ten skater games/five starts). V2 selects one side and at most one item/player;
V3 applies that diversity within each page. V4 research retains that order;
shortlist applies the explicit historical season-gap order described above.
These are descriptive research gates, never win probabilities or EV. Do not
loosen price bounds automatically to fill a list. Legacy servers keep their
sample/matchup ordering. Report fewer picks when coverage is insufficient. Game lines
are context; do not turn a statistical watch into a price-edge claim. Follow
exact evidence selectors for detail when the corresponding tool is available.
Keep unknown freshness, missing quotes, mixed books, and starter limitations.
Read named injury alerts before discussing sides. Date-only get_injury_updates
returns slate flags with bounded whole-record paging; follow next_cursor instead
of calling every game. Stale or incomplete team reports never establish clearance.
For custom saves use goalies, day=today, split=season, prop_screen=true,
page_size=12, metrics saves_per_game/games_started/save_pct/gsax_per_60 and
matchup_market=saves, matchup_window=sea. Follow with goalie_saves evidence;
its recent sample is five starts. L60/L120 are minute windows, not recent starts.
Use describe_resource detail=compact (default) for definitions and units;
detail=full includes benchmark diagnostics. Compact tools intentionally use a
single text block; absence of duplicate structuredContent is not a data failure.
get_goalie_status page_size (1..4, default2) is an upper bound. Advertised
adaptive pages preserve whole games and report counts/byte_limited. Follow
next_cursor with the SAME requested page_size; one oversized game can still fail.
Gamecenter format=compact accepts omitted sections or sections=[analysis].
Pass a returned packet game_id unchanged: schedule and publication IDs are both
accepted opaque selectors. Join tools by league_game_id.
When advertised, include_current_offers=true attaches separate stored exact-line,
book, price and ingestion-time annotations to NHL watches. Preserve the published
reasoning and citation dependencies; a current offer is not evidence that its
published rationale evaluated that line. Missing/stale/started prices stay explicit.
Request cited evidence separately; preserve partial/unavailable market reviews.
opponent_recent describes a broad position cohort including low-volume players;
it is optional background, not a similar-player forecast or selection score.
get_game_odds include_price_math=true adds break-even and normalized same-book
paired prices when advertised. Stored started-game prices stay historical context.
If unavailable, use the existing composable tools without switching connections.
`describe_resource.mcp` distinguishes adapter and API capabilities. A client
whose cached schema omits advertised sections must refresh tools or reconnect
the same connection; a merged source change does not update its tool catalog.

Use live discovery instead of guessing resource, metric, split, unit, or filter names.

For native saved filters, Angles historical tests, or research-and-save requests,
use the bundled `research-handigraphs-filters` skill. Its rules and units differ
from the simple numeric query filters below. The agent tools can save account
items and submit research when authorized; ordinary stats queries remain read-only.

## Workflow

1. Call `list_resources` when the sport or resource is uncertain.
2. Call `describe_resource` before a query unless the exact live metric, split, and filter contract is already present in the current conversation.
3. Call `query_stats` with one resource and a focused metric projection. Prefer compact output for comparisons; request standard output when performance tiers or sample qualification matter.
4. Continue pagination only by passing the returned cursor back to `query_stats` with the same filters and sort.
5. State the split, relevant filters, and `data_as_of` value when summarizing results.

## Query rules

- Use canonical units returned by discovery. A proportion such as 20% is normally passed as `0.20`, not `20`.
- Use only `eq`, `ne`, `gt`, `gte`, `lt`, or `lte` for numeric filters, with no more than five filters.
- Keep one split per query. Do not invent historical dates, archive selectors, custom ranges, or unsupported operators.
- When live discovery advertises `season`, NHL accepts an eight-digit ID such as `20262027`. Omit it to preserve the server default; retain the same season when following a cursor. The current slate is unchanged, and missing stats must not be replaced with prior-season or preseason numbers.
- Prefer stable entity IDs for follow-up lookups when the API returns them.
- Keep payloads focused. Request rich stats or full metadata only when benchmark details are necessary.

## Interpretation

- Treat performance tiers as metric-specific classifications, not universal rankings.
- Report low-sample or unqualified rows clearly rather than presenting them as equally reliable.
- Do not replace a null freshness timestamp, metric value, or tier with an estimate.
- Separate the API result from any analysis or recommendation derived from it.

## Errors

- Never expose credentials, authorization headers or private connection details in results or logs.
- Do not automatically retry `429` or `503` responses. Report the safe error code and honor any retry guidance returned by the tool.
- Keep this stats-query workflow read-only. Use the research skill for account
  saves and historical jobs; explicit save intent and confirmed replacements are
  required even when optional permissions are granted.
