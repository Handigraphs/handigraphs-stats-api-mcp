# Hosted NHL player prop research

The hosted gateway adds `get_player_prop_evidence` when paired with the API's
version-1 NHL `prop_evidence` descriptor and its enabled backend rollout. The
descriptor appears in `describe_resource({ "sport": "nhl", "resource": "skaters" })`.
Read the exact keys from `prop_evidence.markets[].key` alongside sides, fixed lines
and bounds. For shots on goal the key is `skater_shots_on_goal`. The tool uses
`stats:read` with current
account eligibility, Terms and shared quotas.

For broad tonight research, start with the advertised slate brief. It negotiates
compact_v3 when advertised (otherwise compact_v2/legacy), retaining the existing
recent/season price gates. V3 defaults to pregame scope with full-slate/excluded
counts; use `pregame_only=false` for all games. First-page context includes odds,
goalies and named injury alerts. Follow `next_cursor` with the identical date,
markets, candidate_limit, prices and pregame_only; omit include_context on those
calls (default false). Every qualified player-market selection is retrievable;
candidate_limit is per page, with at most one/player/page. Context-heavy first
pages can be orientation-only and explicitly continue at offset zero. Do not
rerun market groups merely to recover omitted candidates.

Use `include_context=false` for an initial context-light read. Snapshots expire
after 180 seconds or eight newer snapshots for the owner. Expiry/cache loss is an
explicit restart error; never silently restart or reinterpret it as no candidates.
Source changes do not shuffle remaining pages. Quotes, starters and injuries are
frozen observations: retain snapshot.as_of/expires_at, quote ingestion time and
status_at_read. Started/stale quotes are unusable context. Refresh without a cursor
for current source inputs and use exact evidence selectors before quoting a bet.

Candidate injury.match is listed/not_listed/unknown in a specific team report;
flagged is true/false/null accordingly. Freshness is separate; not_listed never
means medically cleared. Partial reports/unresolved identities remain unknown.
Bounded named teammate_flags are report facts, not usage impacts. Check omitted
counts and use the returned drill-down, or date-only get_injury_updates for full
slate paging. Shared game/player/statistical_outcome_group IDs help compare
selections across calls; they are not correlation estimates, independence claims,
or proof of identical bookmaker settlement. Keep distinct market/source families.

Qualified candidates are research, not probabilities or EV. For a custom shots screen, discover compact skater
definitions once, then compare recent volume and season opponent ranks.

```json
{
  "name": "query_stats",
  "arguments": {
    "sport": "nhl", "resource": "skaters", "day": "today", "split": "L10",
    "metrics": ["sog_per_game", "icf_per_game", "games_played"],
    "sort": "-sog_per_game", "page_size": 12, "prop_screen": true,
    "matchup_market": "shots", "matchup_window": "sea", "stat_format": "compact"
  }
}
```

Select three to five returned IDs by comparing volume, sample size and the
opponent's SOG-allowed and attempts-allowed ranks. Rank 1 means most allowed on
the declared season/window. Incomplete ranks have an explicit availability state.
`prop_screen` puts the shared matchup basis in `meta.matchup_basis` and keeps
each player's rank, rate, sample and availability on the row.
Fetch the selected players' detailed evidence in one call. This single-ID example
uses an ID returned by the screen.

```json
{
  "name": "get_player_prop_evidence",
  "arguments": {
    "market": "skater_shots_on_goal",
    "player_ids": ["8478460"],
    "sections": ["hit_rates", "odds", "matchup", "opponent_recent"]
  }
}
```

When `prop_evidence.sections` lists them, two more sections put the matchup in
the same call. `matchup` gives the opponent's season rank for the market among
32 teams, with the shared basis once in `matchup_basis`. Rank 1 allows the most
for an over. Send `side: "under"` and the rank and tier read for the under, where
rank 1 allows the least; `side: "both"` adds `under_rank` and `under_tier`.
`opponent_recent` is optional broad position-cohort background, including low-volume
players; it is not a similar-player forecast and does not rank the brief. It
reports unique_players and the player_appearances sample unit alongside how often
players in the same position group cleared
the resolved line against tonight's opponent over its last ten completed games,
as `hit_count`, `appearance_count` and `hit_rate` per side. It needs a line and
returns `line_required` without one. An unranked market or incomplete source is
`unavailable` with a reason. Add `game_logs` when the user wants the games. All
five sections with both sides and season results were verified for three players; four can exceed the byte cap.
A server that does not list a section rejects it before any protected request;
use the three original sections and the screen's matchup rank there.

The API returns recent ten-game skater or five-start goalie rates. Five logs are
the default when requested. Set `log_limit` up to ten or `include_season=true`
when the question needs that detail. Each player resolves its own site main line.
An explicit `line` requests those exact terms. Fixed record markets use their
discovered line and supported side. The shared market registry preserves the
distinction between anytime goalscorer and goals totals.

Present the sample, hits, misses, pushes, missing observations, exact line and
one quote per requested side. The denominator excludes pushes. Historical hit
rates describe observations, while implied probability describes a price's
break-even threshold before costs. Keep those interpretations explicit when
explaining a candidate. Cite the sportsbook and source `fetched_at` timestamp.

Quotes come from ingested storage and become unavailable at game start or after
45 minutes. Recheck these boundaries on cached responses. Report missing or stale
prices and unavailable source sections alongside available evidence. Off-slate
players support logs and explicit-line hit rates. `line_required` requests a line
before calculating an unpriced totals hit rate.

For stored Gamecenter prop research, call `list_gamecenter_games` for the Eastern
date, then call `get_gamecenter_packet` with the returned game ID and `format: "compact"`.
Read `analysis.props` and `analysis.market_reviews` when available. Resolve each
item's zero-based `citation_indices` against the packet's `citation_ids`, then
request just the IDs you need with `sections: ["evidence"]` and `evidence_ids`.
Use a detailed read with `sections: ["analysis"]` when you also need team analysis.

The evidence call admits one market and one to five unique IDs. It returns at
most 8 KiB of JSON. The full worked workflow must fit within 32 KiB across the
two tool results, including structured content and JSON text fallback. Omit
unneeded sections for narrow requests. Honor capacity errors without automatic
retries or expanding the slate. Ordinary research reads create no saved items.

For rollout, deploy the compatible backend first and enable its default-off
`STATS_API_PROP_EVIDENCE_ENABLED` flag through the approved environment process.
Deploy the gateway only after sandbox correctness, payload and capacity checks.
Record both source SHAs, a representative busy slate and measured p95 latency at
five concurrent users. Exercise the configured gateway concurrency ceiling and
verify bounded backend work and backpressure. Native client and live sandbox
acceptance remain distinct from offline official-client tests. The backend flag
is the first rollback control. Production requires the repository's current owner
acceptance/runtime compatibility and native environment approval.

After deployment, clients refresh their tool catalog through reconnect or a new
chat. The hosted plugin's revised bundled skill follows its separately approved
plugin release. Direct URL clients receive the routing hints in tool descriptions.

For broad tonight requests, use the discovery-enabled `get_slate_brief` first. Keep the two-call screen/evidence workflow for custom research. Never pad a top five with unsupported candidates or justify a price as a parlay leg without evidence.

For custom goalie saves, use the existing prop_screen on goalies, day=today,
split=season, metrics saves_per_game/games_started/save_pct/gsax_per_60 and
matchup_market=saves, matchup_window=sea. Follow with goalie_saves evidence, whose
recent sample uses five starts. L60/L120 are minute windows, not recent starts.
Skater matchup discovery also supports assists, points, pp_points and blocks when
advertised. Unknown or incomplete league samples remain unranked.

The v2 brief defaults to -250 through +300; at least 8/10 graded skater games or
five goalie starts; recent observed rate at least price break-even +10pp and
overlapping season rate at least break-even (minimum ten skater games/five starts).
It selects one side and at most one item per player, balancing qualified markets.
Custom bounds require explicit user research intent; never loosen them to pad a
list. Same-book paired normalization is opt-in price arithmetic, not fair odds
from a calibrated sports model. Compact tools intentionally return text only.
