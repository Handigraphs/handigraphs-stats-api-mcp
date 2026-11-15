# NHL availability production operations

Writer: Codex root, Windows desktop, sole writer. Branch
`codex/nhl-availability-production` starts at owner-merged acceptance commit
`ccc2ad94a456e4897e105d2a193ff3486e22b1ff` (PR63). The owner merged exact
review head067abdc and instructed continuation. Its clean source worktree and local
branch were closed; evidence is preserved privately. No runtime edits here.

Accepted pair: app `a9c7bd9379b1862ebf105dca58558a042ed24fdd` (API1.27.0), MCP
runtime `4a42f1a6ca5f6b50f4940206fa90ccbf0ecf95c4`. Deployment sourceccc2ad9
contains only allowed nonruntime changes from that tested runtime. Owner record
digestf92bdb385abbc5e2257d42c591627ef13fedc3071d95561330caf685683693ff.
Five fresh OAuth owners, actual Claude, full CI and cleanup passed; truthful
sandbox history/starter/injury limits and production spot checks remain recorded.

Web production run43769043201 intentionally dispatched at accepted appa9c7bd93
with normal exact-SHA sandbox L4 preflight, no break-glass. It is pending.
Deploy/verify the compatibility reader before promoting the adapter or producer.
Then intentionally dispatch the canonical MCP production workflow atccc2ad9 and
the existing scrapers-web production workflow at appa9c7bd93. Preserve required
native human MCP approval and the scraper run-bound comment/cooldown. Agents
cannot approve either gate. No production completion is claimed from dispatch.

After successful mutation jobs, verify public readiness/contracts, the fresh
actual production client catalog and bounded protected reads. Verify normal
future injury captures separately, using enforced read-only production SQL.
Do not manufacture current source times, write production fixtures, change
eligibility, provision infrastructure, publish packages or add product scope.

Current status: web promotion underway; remaining production workflows not yet
dispatched. Original dirty app checkout and prior operations branches preserved.
Final pushed checkpoint and observed run outcomes will be reported by the
operator. This branch is an operations checkpoint, not another product PR.
