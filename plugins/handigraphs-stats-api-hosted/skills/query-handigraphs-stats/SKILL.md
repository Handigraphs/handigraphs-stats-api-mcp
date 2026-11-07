---
name: query-handigraphs-stats
description: Use the Handigraphs Stats API MCP tools for player statistics and NHL prop research, including tonight's shots-on-goal candidates, matchup ranks, recent game logs, exact-line hit rates and sportsbook quotes. Also use for metric/split discovery, filtered rankings and sample interpretation.
---

# Query Handigraphs Stats

## Connection

This plugin connects to the hosted Handigraphs MCP server at
`https://mcp.handigraphs.com/mcp`, available to eligible Handigraphs All Access members.
Use only this plugin's `handigraphs-stats-hosted` connection;
never silently switch connections, identities or local credentials following
an OAuth failure.

Sign in through the client's browser OAuth flow as the intended Handigraphs
account. Never ask for, accept or repeat an API key, website JWT, access/refresh
token or service secret in chat, tool arguments, headers or configuration.
No local key setup helpers are included. The client discovers public registration
and authorization metadata; do not ask users to register a confidential client.

`stats:read` is required; `filters:write` and `research:run` are independent opt-in
consent choices. A connection grants only approved scopes and current eligibility,
Terms, rollout and worker policy still apply. For 401 or revoked/expired consent,
use the client's reconnect/login flow. For missing scopes, explain the denial;
the owner can revoke the app at `/account/api` and reconnect with explicit consent.
Never approve broader scopes automatically. A lapsed account can still inspect
and revoke connections. Do not fall back to an API key or another account to
bypass policy, quotas, errors or an unavailable worker. Switching to local is a
separate user choice; the existing local installation and keys remain supported.

## NHL prop research

For requests such as "who are the best shots on goal candidates tonight", use
the hosted read-only evidence workflow. Its market support and availability come
from `describe_resource`'s `prop_evidence` descriptor. Other NHL skater markets
and goalie saves follow the same shortlist workflow.

1. Discover the NHL resource once when its contract is unknown. For SOG screen
   `query_stats` with `sport=nhl`, `resource=skaters`, `day=today`, `split=L10`,
   `metrics=[sog_per_game,icf_per_game,games_played]`, `sort=-sog_per_game`,
   `matchup_market=shots`, `matchup_window=sea`, `page_size=12`, `prop_screen=true`,
   and compact output. Shared rank metadata is returned once in `meta.matchup_basis`.
2. Compare recent SOG and attempts volume, actual sample sizes, and the opponent's
   season SOG-allowed rank plus `context.matchup.attempts` rank. Rank 1 means most
   allowed. Preserve unavailable ranks and current-season context. Select three
   to five IDs from the screen. For a named player whose ID is known, start at
   the evidence call.
3. Call `get_player_prop_evidence` once with that market and those IDs. For full
   prop research request `sections=[hit_rates,game_logs,odds]`. Defaults are over,
   recent ten skater games or five goalie starts, and five logs per player.
   Supply an exact user-requested line when present. Otherwise use the site's
   resolved main line. Fixed record markets use their discovered fixed line.
4. Each player has its own line. Compare that exact line's sample and price.
   Report hits/misses/pushes, missing observations and the graded denominator.
   `hit_rate` is a fraction describing historical observations. A price's implied
   probability is its break-even threshold before costs. Explain the evidence
   supporting the shortlist and its limitations.
5. Cite the game/start sample, split, season matchup basis, line, book and
   `fetched_at`. Quotes are the latest ingested prices. They become unavailable
   after 45 minutes or game start. `generated_at` describes the response. Preserve
   missing quotes and per-section source failures. With `line_required`, request
   an explicit line if a hit rate is needed. Requested logs remain available.
6. Keep detailed evidence on the shortlist. Request only the sections needed for
   a narrow follow-up, with at most ten logs per player. A size error requires
   fewer players, logs or sections. Honor 429/503 and Retry-After. Use Gamecenter
   when the user asks for published analysis. Use the filter research skill for
   an explicit historical filter test or save request.

## Shared business workflow

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
