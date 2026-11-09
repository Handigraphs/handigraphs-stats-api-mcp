# NHL availability MCP tools

- Branch `codex/nhl_lineup_availability-pr03`
- Base `a3146ce732c87d877af17729b2b289220c16fadc`
- Active writer Codex Desktop on Windows in an isolated worktree
- Dependency Stats API 1.21.0 from [app PR #847](https://github.com/cjbuskey/handigraphs-app/pull/847)
- Scope from the [availability plan](https://github.com/cjbuskey/handigraphs-app/blob/c579d5819dc16b54c079fa18d52a1e616efd69fc/plans/nhl_lineup_availability/plan.md)

Both transports expose `get_goalie_status` and `get_injury_updates` with
independent discovery gates and exact same-origin paths. Each successful call
returns one JSON text block capped at 3,584 UTF-8 bytes.

The full local MCP validation profile passed with 194 tests passing and two
skips. Mock coverage includes older and forged discovery, exact cursor
forwarding, a stale injury report, a changed confirmed goalie, and the
official SDK over stdio and hosted HTTP.

For hosted sandbox acceptance, compare the November 9 goalie slate, the
NYR–EDM injury pages and both stale DET–STL team reports with stored rows.
The sandbox has no stored frozen-to-confirmed pair. The synthetic fixture
covers that case. Hosted Claude and the exact sandbox deployment are pending.

Code checkpoint: `f1ebb0278744a71e104e664cdc3a6afb6980a9bc`.
