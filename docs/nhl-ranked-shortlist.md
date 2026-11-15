# NHL ranked shortlist

API1.27 advertises compact_v4 in NHL discovery. For a top-ten request use
`get_slate_brief({sport:"nhl",date:"YYYY-MM-DD",view:"shortlist",candidate_limit:10})`.
Selection runs over the complete covered eligible player-market pool before
pagination. Exact season hit counts/graded samples and quoted break-even determine
order, followed by season sample, recent gap/sample, directional rank and stable
identity/market ties. One market per player is chosen globally. This is descriptive
screening, not a calibrated probability or expected-value model.

V4 returns a flat ordered `candidates` array. Shortlist `rank` is global, including
on continuation pages. `coverage.eligible_player_markets` and `groups.pool_eligible`
count the qualified pool before player collapse. `coverage.eligible` and per-group
`eligible` count the selected unique-player population. `ranking` discloses basis,
pool/unique counts and source coverage. A partial source pool cannot establish the
best selection among unavailable data. Alternative market keys remain on each
candidate and all alternatives remain accessible in research view/evidence tools.

Research view is the default and retains the previous round-robin ordering.
Shortlist defaults `include_context=false`; research first pages default true and
all continuations default false. Explicit `include_context=true` adds full game
context. Each page always includes its candidates' `team_contexts`, including
separate report/source freshness, named bounded flags, unresolved names/counts and
omission counts. A candidate's `matched_known_entry=false` describes only resolved
entries; overall `match=unknown` and `flagged=null` remain when resolution is
incomplete. Shared reported players are team facts: exclude the candidate itself
for teammate interpretation. No medical clearance or usage effects are inferred.

Cursors retain the existing fixed180s/eight-snapshot limits and now bind view as
well as format/date/markets/limit/game cap/prices/pregame scope. Context is representation
only and may change. No continuation source reads, silent restarts or retries.
Explicit unsupported view fails before a protected request on older APIs; v3/v2/
legacy remain supported. The complete serialized MCP brief stays <=32KiB.

## Availability follow-up

Optional advertised `max_candidates_per_game` (1..12) applies only to an explicit
`view=shortlist`. It limits the entire frozen list after global player dedup,
before pagination; default remains uncapped. `rank` counts selected positions and
`pool_rank` retains uncapped positions. `ranking.unique_players_before_game_cap`
and `game_cap_excluded` disclose the population removed. `coverage.eligible` counts
the capped pool; raw player-market counts stay unchanged. A game cap controls
concentration; it is not a correlation model or a guarantee of safer selections.

`candidate_limit` is an upper bound. Inspect returned/byte_limited/remaining and
follow next_cursor with unchanged selectors (including cap), without restarting
or broadening controls silently. Requested twelve can return fewer when bytes,
coverage, player collapse or the explicit game cap limit the list.

Advertised adaptive `get_goalie_status` pages retain whole games within the
existing3.5KiB ceiling. `page_size=4` requests at most four games; coverage reports
requested/actual/offset/total/remaining/byte_limited. Follow next_cursor with the
same requested page_size until null. One protected GET per page, no retries;
an intrinsically oversized single game still fails explicitly.

The backend's future injury captures may resolve a missing provider-ID bridge by
a unique normalized exact name on the canonical current team, including goalies
and injured players. Wrong-team, ambiguous or conflicting provider mappings stay
unresolved. This does not rewrite old reports, assign permanent provider IDs,
provide medical clearance or certify reports whose source coverage is missing.

Packet `game_id` values from brief selectors and list responses are opaque and
both schedule/publication forms are accepted. Pass them unchanged. Cross-tool
joins use `league_game_id`. Accepted publication prose/citations remain intact.

## Gamecenter prices

`get_gamecenter_packet` optionally accepts `include_current_offers=true` when the
agent discovery advertises enabled NHL support and analysis is selected. Compact
and standard reads retain accepted prose/citations unchanged and attach an
independent `current_offers` sidecar. Each entry identifies its local prop index,
canonical player/watch market/side, exact current stored line, book, price, source
family and ingestion time, with evidence selectors. The sidecar clock never
replaces publication generation or source freshness. A watch has not necessarily
been assessed at the displayed offer. No new generation or provider refresh runs.

At most ten watches are annotated in one bounded backend batch. Missing identities,
unsupported markets, historical dates, unavailable sources, stale quotes and
started games are explicit. Publication/evidence cursor identity excludes dynamic
prices. Compact pages contain annotations only for props on that page with rebased
local indices; a stored-price change does not invalidate a frozen publication page.
No eligibility, scope, quota or rollout changes and no package publication.

Acceptance requires a140-selection fixture's true top ten distinct players in one
protected SDK read <=32KiB, deterministic ties and self-contained team references;
all alternatives in research pages; strict old-server/cursor behavior; quote
identity/freshness and unchanged accepted content/citations. Live sandbox Redis,
OAuth and an actual fresh client must bind the new source pair before production;
fixtures and a successful deployment alone establish no live acceptance.
