# MCP recovery acceptance handoff

- Branch `codex/mcp-recovery-acceptance`
- Base and tested MCP runtime `50ee30d66abb4f79a16842f878329c501ea86d44`
- Tested and proposed accepted web source `b749e8ae72cd59c125c316e054a159151a2290d5`
- Active writer Codex desktop on Windows in an isolated worktree
- Record, runbook, and assertion checkpoint `4d7bbb70e39b86040ce49e18e6b8b4ff8cd1ce36`

The sandbox gateway deployed the reviewed MCP revision as v8. Claude Desktop
recovered from all three invalid inputs. The sorted skater read was empty, the
prop read returned hit rates and five logs, and an older stored Gamecenter
packet returned analysis and one cited fact. The test flag returned to unset
after the replay and sandbox web v1407 succeeded on the same source slug.

Local Node 22 validation passed with 182 tests and two existing skips. The
production audit, typecheck, build, package, distribution, and Desktop bundle
checks passed. The acceptance record parses canonically. The branch changes
only paths permitted by the production runtime comparison.

The next step is owner review of the scoped acceptance PR. Production dispatch
and its native approval are separate. The exact tested runtime and web pair
must be checked again if either source moves.
