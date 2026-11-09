# NHL game odds production acceptance proposal

This proposal covers [MCP PR #46](https://github.com/Handigraphs/handigraphs-stats-api-mcp/pull/46)
and both November 9, 2026 hosted sandbox checks. The owner reviews the proposed
source pair and the promotion order before any remaining production work.

| Component | Tested source | Sandbox release |
| --- | --- | --- |
| Scraper provenance | `06e942a74c469c8323b78a7b6686ba3a979cad50` | [v574](https://github.com/cjbuskey/handigraphs-app/actions/runs/42657205466) |
| Stats API | `f004abe542da0e3b26ec6253b333be1ce1c8e325` | [v1409](https://github.com/cjbuskey/handigraphs-app/actions/runs/42658378506), with the odds flag enabled temporarily in v1410 and v1412 |
| Hosted MCP | `e5c95fe949b8132559328bb6fdb273a83046a3a2` | [v11](https://github.com/Handigraphs/handigraphs-stats-api-mcp/actions/runs/42663472631) |

The application SHA includes both application PRs and passed
[the exact-SHA sandbox web smoke](https://github.com/cjbuskey/handigraphs-app/actions/runs/42658959466).
Claude Desktop 4.23118.0.0 Chat used the existing hosted sandbox OAuth connector.
The acceptance digest identifies the private redacted receipt. The record's
`clients` map retains historical versions from the compact-pagination acceptance.

## Hosted Claude checks

- **Stored quotes and pagination.** After refreshing Claude's cached connector
  catalog, the September 29 slate returned four games and a cursor, then one
  game and a null cursor. Both expanded pages and both single-game cards
  displayed in full. The four-game page was 2,589 bytes. The FLA–CAR lookup
  matched all six stored prices and lines, the fixture ID, and the ingestion
  timestamp. The June 14 CAR–VGK lookup returned prices with `book: null` for
  all three markets.
- **Fresh BetOnline quotes.** The initial refresh failed while the sandbox
  odds ID sequence was behind existing rows. After a sandbox-only sequence
  repair, one normal refresh wrote odds for NYR–EDM, PHI–VAN, and NYI–SJS.
  Claude returned the full November 9 slate in one 1,903-byte expanded card
  with a null cursor. All 18 selection prices and lines matched PostgreSQL.
  Each of the nine markets stored source ID `34` and returned `BetOnline`.
  All three `fetched_at` values matched the database ingestion timestamp
  `2026-11-09T17:34:58.277513+00:00`.

Both flag changes were restored to unset. Sandbox discovery reports odds
disabled after v1413. The temporary sandbox deployment secret, opt-in, and
Heroku authorization were removed.

## Production rollout order

1. **Scraper.** Promote the source containing
   [app #844](https://github.com/cjbuskey/handigraphs-app/pull/844) with
   `deploy-scrapers-stats-prod.yml` on main. At review, scraper v265 predates
   #844. Check the production odds ID sequence against existing rows read-only
   before the first refresh on the new release. Verify the next normal refresh
   stores source ID `34` and a new `fetched_at` on full-game quotes. Legacy rows
   keep their unknown books.
2. **Stats API.** Confirm the web source contains
   [app #845](https://github.com/cjbuskey/handigraphs-app/pull/845). Production
   web [v643 already deployed the exact tested app SHA](https://github.com/cjbuskey/handigraphs-app/actions/runs/42661859434),
   and discovery currently advertises contract 1 with odds disabled. If a new
   web deployment is required, use `deploy-web-prod.yml` with the exact-SHA
   sandbox L4 gate. After the scraper check passes, enable
   `STATS_API_GAME_ODDS_ENABLED=true` on the production web app under separate
   rollout authorization. Verify discovery and one authorized read of the
   latest stored pregame odds before proceeding.
3. **Hosted MCP.** After owner approval and merge of this acceptance PR,
   dispatch `deploy-mcp-prod.yml` from main with the full merged MCP SHA,
   `app_sha=f004abe542da0e3b26ec6253b333be1ce1c8e325`, and confirmation
   `deploy-production`. The runtime comparison and native GitHub production
   environment approval still apply. After readiness succeeds, verify
   `get_game_odds` through the production hosted connection. Refresh the
   client's tool catalog if it still shows the prior tool set.
