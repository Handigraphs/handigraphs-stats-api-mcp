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


## Live promotion checkpoint

Web production43769043201 succeeded at accepted appa9c7bd93. Public production
readiness, OpenAPI1.27.0, advertised adaptive goalie/game-cap support and literal
available/recommended hosted URL passed. This chat's existing hosted connector
then retrieved all5 games at requested page_size4 across3 pages (2/2/1), with
explicit byte limiting on the first2 pages, zero errors/retries. New adapter had
not deployed yet: its gate was still waiting. This establishes the repaired
endpoint's compatibility with the prior connected client.

Canonical MCP production run43769558786 intentionally dispatched atccc2ad9 with
accepted appa9c7bd93. Validation and owner/runtime acceptance passed; native human
production approval is waiting. Scrapers-web run43769558768 intentionally
dispatched at appa9c7bd93; exact-SHA preflight passed and its manual gate waits.
Issue893 binds the scraper run and digest
c73c1cad4caf3bcc99367ff8f4e42b0798d8623aa001f619195ecf9b621b6220.
Its request expires2026-11-15T22:59:23Z, after30 minutes, with a5-minute cooldown
after the required owner comment. Never approve either gate as an agent.

Both exact GitHub pages are open and marked for human handoff; MCP review dialog
is open with production unselected. Owner was asked to select production and
submit Approve and deploy, and separately comment the exact APPROVE digest on
issue893 while leaving it open. Browser handoff remains active until the human
outcomes are observed. No agent approval/comment was submitted. Private proof
screenshots retained. As of the latest read, MCP review history and issue comments
are empty; both mutation jobs remain blocked at their human gates.

Next: verify actual human receipts, monitor successful mutation jobs (not just
approval), then refresh the existing production Claude catalog and run bounded
read-only goalie/cap/evidence checks. Verify future injury capture identity matches
with read-only SQL. Pre-producer baseline found all3 known source IDs unresolved
and all3 permanent provider IDs still null; do not repair rows directly. Preserve
source clocks and ambiguous/old observations. No package publication.


## Human receipt and live MCP

Owner returned after submitting approvals. GitHub records native MCP approval by
cjbuskey, and production run43769558786 succeeded including the deploy mutation
job atccc2ad9. Browser also visibly confirmed success and the human approval;
private screenshot retained. Web remains live/verified at API1.27.0.

Original scraper request43769558768 expired with no issue893 comment. Its later
attempt2 displayed overall success but intentionally skipped both approval and
Cloud Run mutation. That rerun did not deploy. Under existing rollout authority,
a fresh first-attempt run43774683796 was dispatched at the same accepted appa9c7bd93
with normal preflight, no break-glass. Replacement issue894 binds digest
67de08c47b1ecb42ca507505053e5f3f50c9fa6ad45cabbcd674ae3f4f07ad35.
Owner independently posted the exact approval at2026-11-15T23:26:29Z, comment
6903151316 bycjbuskey, unedited (created_at=updated_at). Browser and API verified
it; no additional approval was requested or submitted by an agent. Its5-minute
cooldown ends no earlier than23:31:29Z; request expiry23:55:04Z. Mutation not yet
complete at this checkpoint. Preserve the issue open and let the gate recheck.

Actual production Claude smoke is running through the existing production
connector; its visible brief schema already contains11 inputs. No production
account/cohort/flag changes or credentials/traces. Final bounded client output,
producer mutation success and new normal-capture identity evidence remain.

## Production rollout complete — 2026-11-15

This section supersedes the pending status above. Root Codex Windows desktop
session is the active writer; this branch contains operations notes only.

Production web [43769043201](https://github.com/cjbuskey/handigraphs-app/actions/runs/43769043201)
and canonical MCP [43769558786](https://github.com/Handigraphs/handigraphs-stats-api-mcp/actions/runs/43769558786)
both completed their actual mutation jobs successfully. MCP validation and
owner/runtime acceptance passed, and cjbuskey's native human production approval
was verified. App remains `a9c7bd9379b1862ebf105dca58558a042ed24fdd`, API 1.27.0.
Deployed MCP source `ccc2ad94a456e4897e105d2a193ff3486e22b1ff` remains
runtime-equivalent to tested `4a42f1a6ca5f6b50f4940206fa90ccbf0ecf95c4`; there
were no runtime edits or npm/MCPB publication.

Replacement scrapers-web [43774683796](https://github.com/cjbuskey/handigraphs-app/actions/runs/43774683796)
succeeded on its first attempt, after exact-SHA sandbox preflight, issue 894 human
approval/cooldown and the actual Cloud Run mutation. Revision
`handigraphs-scrapers-web-00039-ttd` is Ready; authenticated /health is healthy.
Original 43769558768 attempt 1 expired and attempt 2 skipped mutation; its green
rerun was not deployment. No agent comment/approval or bypass was used.

### Actual production Claude verification

[Production client chat](https://claude.ai/chat/c7e2da33-1456-466f-8acf-5a358e79391e)
used the existing production connection, without account, flag or scope changes.
Visible schema had 11 brief inputs; discovery reported contract 1.27.0/catalog
`nhl-availability-caps-v1`/adapter 0.3.0, with all five evidence sections invocable.

Initial bounded run attempted seven calls: six results and one no-result cap-two
call without an error body. Preserve that observation as a failure. Separate
bounded two-call follow-up passed without retries, giving nine total attempts,
eight results and one unattributed no-result observation.

- Goalies requested page_size=4: all five distinct games in 2/2/1 whole-game
  pages, truthful byte limiting and no duplicates or remaining games.
- Cap one: five candidates from five games, ranks 1–5/pool ranks 1/2/6/8/11,
  69 before cap and 64 excluded by cap.
- Cap two: 3+3 returned, ranks 1–6/pool ranks 1/2/3/4/6/8, max two per game,
  four of ten unseen. Unexpired same snapshot, no byte limiting.
- Exact Carlsson SOG under 2.5 evidence matched 7/10 recent, 17/20 season,
  quote and matchup. Source/quote clocks and limitations were preserved.

A safe bounded router metadata read counted 17 POST /mcp requests during
23:30–23:40:59Z (12 HTTP 200, three 202, two 400; max service 2,091 ms). They
cannot be attributed to one client call; no-result cause remains unknown.
Readiness returned 200. No authenticated raw logs, bodies or traces were saved.

### Producer capture and current API observations

The normal hourly trigger and one force-gate HTTP run retained cached HTML's
original clocks. Fresh-capture proof then used the unchanged accepted canonical
CLI once, scoped to EDM/VAN/FLA and 2026-11-15 with --force --force-refresh.
It wrote three genuine new injury observations, exit zero, no fetch/store
failures. Read-only SQL and current connected API checks verified:

- Andersen source 1942 -> NHL 8475883;
- Demko source 2722 -> NHL 8477967;
- Gadjovich source 4612 -> NHL 8479981.

Source updates and observations remain separate; all three permanent provider
columns remain null. The older tomorrow VAN row stayed unchanged/unknown.
No direct production SQL repair, fixture, canonical provider-ID assignment,
manufactured timestamp, account/cohort or rollout-flag change occurred.
Seven post-capture protected connected API reads were made: one brief and two
rounds of three injury reads (first local comparison used numeric instead of
serialized string IDs; corrected checks passed). The earlier Claude injury
unknowns preceded these new observations.

Private production verification SHA256:
`09836c59bed7a545128aec65f02b4a2357dddb1e7136a08bf725e2bfaf00fc74`.
Accepted sandbox observation stays unchanged at
`f92bdb385abbc5e2257d42c591627ef13fedc3071d95561330caf685683693ff`.
Private proof screenshots and safe aggregate reports were retained separately.

Authorized rollout and bounded checks are complete. Monitoring limit: one
unattributed production client no-result observation; successful follow-up does
not erase it. Only six of ten cap-two candidates were inspected in production.
Unknown/older coverage and historical screening arithmetic retain their caveats.
The commit containing this section is this branch's final operations checkpoint;
the final pushed SHA is reported separately. No new product PR or publication.
