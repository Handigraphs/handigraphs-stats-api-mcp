# NHL ranked shortlist

API1.26 advertises compact_v4 in NHL discovery. For a top-ten request use
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
well as format/date/markets/limit/prices/pregame scope. Context is representation
only and may change. No continuation source reads, silent restarts or retries.
Explicit unsupported view fails before a protected request on older APIs; v3/v2/
legacy remain supported. The complete serialized MCP brief stays <=32KiB.

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
