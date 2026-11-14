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
When enabled, call `get_slate_brief` once with an explicit Eastern date and
sport `nhl`. It supports today and regular season only. Candidates are grouped
by market and ordered by sample completeness and directional matchup rank, not
predicted value. Report fewer picks when coverage is insufficient. Game lines
are context; do not turn a statistical watch into a price-edge claim. Follow
exact evidence selectors for detail when the corresponding tool is available.
Keep unknown freshness, missing quotes, mixed books, and starter limitations.
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
