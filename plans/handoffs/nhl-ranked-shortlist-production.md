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
acceptance SUCCEEDED; the human subsequently submitted native production review.
Exact run: https://github.com/Handigraphs/handigraphs-stats-api-mcp/actions/runs/43754066725
GitHub's approval API records production approved by cjbuskey. The task-owned
browser visibly showed that approval and deployment starting; no agent approval
was submitted. The workflow is now completed SUCCESS, including its production
mutation job at exact53f543f. The gate rechecked source, owner/runtime and human
approval before building, then verified release commit and readiness. No redispatch.
Both production readiness endpoints return200; public API1.26 and compact_v4
remain advertised. /oauth/status is literally available/recommended with exact
hosted_url=https://mcp.handigraphs.com/mcp. No new production flag/config changes
outside the already approved deployment workflow and no production data writes.

Actual production Claude smoke PASSED using the existing Handigraphs
connector. Its cached catalog initially showed v3; Refresh tools list on that
same connection now visibly exposes ten brief/nine Gamecenter inputs and current
v4 guidance. No reconnect, broader grant or permission change. One public compact
descriptor and three protected reads completed: shortlist, first-candidate exact
line/season evidence, and compact Gamecenter/current offers. Native metadata:
API1.26.0, adapter0.3.0, catalog nhl-ranked-shortlist-v1; build_sha remains null,
so exact source proof comes from the successful workflow/control-plane checks.

Production snapshot20:04:53Z, November15: five pregame games;159 qualified
player-market rows/63 unique players, returned ranks1..10 with ten distinct
players, no byte limit. First-candidate evidence matched recent7/10, season17/20,
Under2.5 SOG, MGM-120 and ingestion timestamp. Seven shared team contexts had
complete/fresh reports; unresolved names and unknown statistics source time were
disclosed without clearance/usage estimates. One confirmed-starter saves candidate
qualified. No schema/size failure, retry, continuation, write/job, other connector,
bet or unsupported probability/value claim occurred.

Production Gamecenter was published with incomplete assessment/review_unavailable;
its separate current-offer sidecar returned FOUR available exact-line/book/price
annotations (SOG4.5, goals0.5, points0.5, PPP0.5). Partial budget_exhausted reviews
and unknown source freshness remained visible. This is NEW post-production
positive quote evidence; do not relabel the earlier sandbox unavailable watch as
positive or rewrite the accepted historical record/digest.

Claude suggested a size mismatch; source inspection confirms30000 is the API
body budget reserving MCP envelope/escaping space, and fits also checks the whole
envelope below32512 (adapter ceiling32768). These limits are consistent, not a
release defect. Other timestamp/name-mapping observations were not independently
established as new defects and were not used to expand this finite release.
Private rendered screenshot/aggregate receipt retained without authenticated
traces. Deployment and read-only smoke complete; no required work or human gate
remains. No npm/plugin/MCPB publication, DDL or new production activation flag.

This handoff checkpoint is separate from the tested runtime and accepted merge.
Final pushed hash, deployment outcome and remaining human action will be reported.
