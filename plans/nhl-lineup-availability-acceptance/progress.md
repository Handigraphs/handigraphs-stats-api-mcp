# NHL availability production acceptance

- Branch `codex/nhl-lineup-availability-acceptance`
- Base and tested MCP runtime `01fd77a9fd79bcc481287e9bf88b90070a080560`
- Acceptance record checkpoint `f4a8a2af95db37daf78418fd7b5cacff5f6c66c7`
- Writer Codex Desktop in a dedicated Windows worktree
- Dependencies app #846 and #847, MCP #48

The [acceptance notes](../../docs/nhl-lineup-availability-acceptance.md) pin the
sandbox pair, document the seven hosted Claude results and their comparison
with stored observations, and specify the production rollout order. Both
sandbox reader flags are unset. The matching frozen-to-confirmed case remains
covered by a fixture.

The full Node 22 MCP profile passed, including tests, production dependency
audit, type checks, build, npm pack, distribution checks, and MCPB validation.
The recorded digest matches the evidence summary. Owner review is pending.
The production database, scraper, API enablement, and hosted deployment are
separate operator steps.
