---
name: query-handigraphs-stats
description: Use the Handigraphs Stats API MCP tools to discover and query live MLB or NHL statistics. Trigger for player or team stat lookups, matchup comparisons, supported metric or split discovery, filtered rankings, pagination, and interpretation of Handigraphs performance tiers or sample qualification.
---

# Query Handigraphs Stats

Use live discovery instead of guessing resource, metric, split, unit, or filter names.

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
- Prefer stable entity IDs for follow-up lookups when the API returns them.
- Keep payloads focused. Request rich stats or full metadata only when benchmark details are necessary.

## Interpretation

- Treat performance tiers as metric-specific classifications, not universal rankings.
- Report low-sample or unqualified rows clearly rather than presenting them as equally reliable.
- Do not replace a null freshness timestamp, metric value, or tier with an estimate.
- Separate the API result from any analysis or recommendation derived from it.

## Errors and credentials

- Never ask for or repeat a Stats API key in chat. If the local server is not configured, direct the user to create a reveal-once key at `https://handigraphs.com/account/api` and configure it through the client or environment.
- Do not automatically retry `429` or `503` responses. Report the safe error code and honor any retry guidance returned by the tool.
- Treat every tool as read-only. Do not imply that the plugin can modify Handigraphs data or account settings.
