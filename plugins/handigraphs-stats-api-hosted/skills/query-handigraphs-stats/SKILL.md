---
name: query-handigraphs-stats
description: Use the Handigraphs Stats API MCP tools to discover and query live MLB or NHL statistics. Trigger for player or team stat lookups, matchup comparisons, supported metric or split discovery, filtered rankings, pagination, and interpretation of Handigraphs performance tiers or sample qualification.
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
