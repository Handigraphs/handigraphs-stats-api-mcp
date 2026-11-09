# Hosted NHL player prop research

The hosted gateway adds `get_player_prop_evidence` when paired with the API's
version-1 NHL `prop_evidence` descriptor and its enabled backend rollout. The
descriptor appears in `describe_resource({ "sport": "nhl", "resource": "skaters" })`.
Read the exact keys from `prop_evidence.markets[].key` alongside sides, fixed lines
and bounds. For shots on goal the key is `skater_shots_on_goal`. The tool uses
`stats:read` with current
account eligibility, Terms and shared quotas.

For “who are the best shots on goal candidates tonight”, discover skater metrics
once, then screen recent volume and season opponent ranks.

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
    "sections": ["hit_rates", "game_logs", "odds"]
  }
}
```

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

For stored Gamecenter analysis, call `list_gamecenter_games` for the Eastern
date, then call `get_gamecenter_packet` with the returned game ID and
`sections: ["analysis"]`. Read `analysis.props` and `analysis.market_reviews`
when present. Fetch only the needed facts in a separate call with
`sections: ["evidence"]` and their `evidence_ids`.

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
