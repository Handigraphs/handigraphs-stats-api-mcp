# NHL ranked shortlist production operations

Active writer: Codex root, Windows desktop. Branch codex/nhl-ranked-shortlist-production
from accepted PR61 merge53f543f6bd3f576fdc9f463367d3afe1c5f15102. The owner
explicitly approved acceptance, exact-head merge05ecae3 and web/MCP production
rollout. PR61 merged on November15,19:39 UTC. Its clean pushed/verified worktree
and local branch were removed after merge/head verification. Original checkouts,
the separate app operations branch and older checkpoints are preserved.

Accepted/tested pair: app97a8a4c9221238efa79903f56f6b09da9f0c1fec / MCP runtime
0422559edf191806ce3854201fa2494af25573ef. Accepted record and production source
53f543f differ from that MCP runtime only in the allowlisted record/docs/test
paths; no src/package/lockfile/Procfile/gate mutation. Safe observations SHA256
511bde3e57df6fdaf4624d413301e98f691724a1d116cc18d67938b0f9ab017c.

Prior sandbox evidence and its limits are in docs/nhl-ranked-shortlist-acceptance.md:
five fresh OAuth owners and actual Claude passed, complete top ten from169/63,
all63 in7 pages, max28805 bytes, cold p95=3590ms/warm602ms, exact-line parity,
cursor isolation, refresh/revocation and cleanup. Timestamp-preserving production
lineup mirrors were used in sandbox. Injury coverage was unavailable/history older;
positive published-watch price joins remain fixture-only. No new generation,
provider, model/value forecast, eligibility expansion or distribution publication.

Approved production web run43753610809 SUCCEEDED at exact app97a8a4c9. Its normal
exact-SHA sandbox L4 preflight and Heroku mutation both passed. Readiness200,
root contract1.26.0 and advertised compact_v4 were verified publicly. The first
verification assertion looked for version under the wrong metadata field; reading
the actual root contract_version corrected that without any runtime change.
Main was rechecked before dispatch; do not redispatch a completed deployment.
Merged MCP CI and sandbox run43753602610 both passed at53f543f.

MCP production run43754066725 was intentionally dispatched at exact main53f543f
with accepted app97a8a4c9 and confirm=deploy-production. Validation and owner/runtime
acceptance SUCCEEDED; deploy is waiting for native production review by cjbuskey.
Exact run: https://github.com/Handigraphs/handigraphs-stats-api-mcp/actions/runs/43754066725
Its review dialog is open in the task-owned Chrome tab, marked for handoff. The
human must select production and submit Approve and deploy; no agent approval.
Private screenshot retained. User has been asked for that exact final action.

Remaining: observe human approval, then verify the mutation job/commit/readiness
and fresh production-client behavior. No new production flag is needed: existing
V2 is true. Do not describe MCP production as complete before its mutation succeeds.

This handoff checkpoint is separate from the tested runtime and accepted merge.
Final pushed hash, deployment outcome and remaining human action will be reported.
