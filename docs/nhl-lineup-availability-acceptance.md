# NHL goalie status and injury updates acceptance proposal

This proposal covers [MCP PR #48](https://github.com/Handigraphs/handigraphs-stats-api-mcp/pull/48).
The owner reviews the tested source pair and production rollout order in this PR.

| Component | Tested source | Sandbox deployment |
| --- | --- | --- |
| Cloud Run scraper | `7d0108cf39f8ac460b17309686a21399910e2d48` | [App #846 deploy](https://github.com/cjbuskey/handigraphs-app/actions/runs/42686207117) |
| Stats API | `c579d5819dc16b54c079fa18d52a1e616efd69fc` | [Web v1416](https://github.com/cjbuskey/handigraphs-app/actions/runs/42692105134), with both flags enabled temporarily in v1423 |
| Hosted MCP | `01fd77a9fd79bcc481287e9bf88b90070a080560` | [MCP v13](https://github.com/Handigraphs/handigraphs-stats-api-mcp/actions/runs/42704026465) |

The Stats API revision contains [app #847](https://github.com/cjbuskey/handigraphs-app/pull/847)
and passed [sandbox L4 on that SHA](https://github.com/cjbuskey/handigraphs-app/actions/runs/42692683561).
The owner acceptance record keeps the historical client versions required by its
schema. Its digest covers this UTF-8 evidence summary with LF line endings.

## Hosted Claude results

On November 9, 2026 ET, Claude in Chrome used the hosted sandbox OAuth connector.
All seven expanded tool responses displayed without truncation. Each of the three
cursor chains reached a null final cursor. The comparison used independent
read-only queries of the sandbox schedule and observation tables.

| Tool and fixture scope | Pages | Compared with PostgreSQL |
| --- | ---: | --- |
| `get_goalie_status`, November 9 slate | 2 | 3 games and 6 observations, including 5 confirmed and 1 expected |
| `get_injury_updates`, November 9 NYR–EDM | 3 | 2 complete team reports and 10 player flags, with both source updates fresh |
| `get_injury_updates`, November 10 DET–STL | 2 | 2 complete team reports and 8 player flags, with both source updates stale |

The comparison covered game and player identities, statuses, game-time decision
flags, sources, observation and ingestion timestamps, and team-page update
timestamps where present. The sandbox slate lacked a matching frozen Gamecenter
publication. The changed-starter case is covered by a fixture. Raw response
byte counts were unavailable in the expanded Claude cards.

Both flags were restored to unset in sandbox web v1424. NHL discovery then
reported both operations disabled.

## Production rollout order

1. **Cloud Run scraper.** Confirm that both providers' normalized data may be
   exposed through the Stats API and MCP. Apply the reviewed additive
   `scrapers-web/sql/create_nhl_availability_observations.sql` to the verified
   production database under separate authorization. Check both tables, indexes
   and writer/reader access. Promote the scraper containing
   [app #846](https://github.com/cjbuskey/handigraphs-app/pull/846) through
   `deploy-scrapers-web-prod.yml` and its run-bound human approval. Enable
   `NHL_AVAILABILITY_CAPTURE_ENABLED=true` on the deployed service under
   separate rollout authorization. Verify the next normal RotoWire and Daily
   Faceoff runs store pregame rows for the correct fixtures, with matching
   statuses, coverage, and source and ingestion times. Check that the existing
   projected goalies and line combinations still refresh.
2. **Stats API.** Promote the tested app revision with `deploy-web-prod.yml`
   and the exact-SHA sandbox L4 gate. After the corresponding source check
   passes, enable `STATS_API_NHL_GOALIE_STATUS_ENABLED` and
   `STATS_API_NHL_INJURIES_ENABLED` independently. Verify discovery and one
   protected production read for each enabled operation against stored rows.
3. **Hosted MCP.** After owner review and merge of this proposal, and after
   both Stats API checks pass, dispatch `deploy-mcp-prod.yml` from main with
   the full merged MCP SHA, `app_sha=c579d5819dc16b54c079fa18d52a1e616efd69fc`, and confirmation
   `deploy-production`. The runtime comparison and native GitHub production
   environment approval apply. After readiness passes, verify both tools
   through the production hosted connection.
