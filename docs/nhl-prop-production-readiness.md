# NHL prop research: production readiness

This is a release proposal and operator checklist, not a production deployment or
activation. The owner must explicitly approve merging the proposed acceptance
record. A merge still does not authorize production configuration, workflow
dispatch, feature activation or publication. The existing native production
environment approval remains mandatory; agents never approve it.

## Acceptance scope and provenance

The proposed exact pair is app `67c0b3ba9f4649d1695f6d46386d3545eba852af` and MCP
`a0bc4d0539280719135461092fda200e1ad5a1f2`. Sandbox observations completed on
2026-11-07 at 17:47:55 UTC. The SHA-256 of the immutable private operator record,
normalized only to LF, is
`c90e7a5069c4e8f00d96385326c17e7b93012dbda61b41a9a0e07f5aa63071b1`.
Private provenance and authenticated payloads remain private; the record is not a
new launch-workflow artifact or an approval issue.

Fresh client testing used Codex CLI 0.146.0 with the exact sandbox server and a
readonly discovery/stats/evidence tool allowlist, in direct-URL and temporary
source-skill modes. Each made exactly one twelve-row screen and one shortlist
evidence call after discovery. Complete text plus structured results were 29,790
and 30,303 bytes, below 32 KiB. The SDK separately checked the full hosted catalog.
Five-owner p95 was 170 ms for screening and 103 ms for evidence. All ten NHL market
contracts, current/started-game quote handling, explicit-line history, bounded
capacity and immediate ordinary-read recovery passed. Five revoked grants each
produced an actual next gateway 401; fixture credentials and flags were cleaned up.

This is a research-delta acceptance, not a repeat of the earlier full OAuth
campaign. The [2026-10-24 acceptance](owner-acceptance-2026-10-24.json) is preserved
unchanged. The legacy schema still requires all three client version fields:
`codex_cli=0.146.0` is fresh, while `codex_desktop=26.1016.61520` and
`claude_code=2.1.283` are historical baseline versions. Desktop/Claude UI consent,
refresh and their new tool-catalog behavior were not rerun on this pair. The new
record's summary states this explicitly. Owner review must accept this scope;
do not relabel historical observations as current-pair proof.

No runtime files or dependencies change in this readiness PR. The production
commit includes only acceptance, documentation, deployment-control and test
changes relative to the tested MCP runtime. Existing compatibility checks must
continue rejecting any later `src/`, lockfile, package or build-input change.

## Before production mutations

1. Obtain explicit owner approval for the acceptance-record merge, then separate
   authorization for the exact production deployment/configuration/activation.
   Recheck current main, source compatibility and the backend's same-SHA sandbox
   L4; do not bypass gates or deploy an unrelated newer main revision.
2. Verify the production deployment credential without revealing its value. The
   `HEROKU_MCP_PRODUCTION_API_KEY` secret exists, but presence proves neither
   scope nor build permission. The successful temporary sandbox profile was
   `identity,read,write,read-protected,write-protected`; it was revoked and no
   global fallback was used. Prefer an app-limited deployer account. Heroku OAuth
   scopes otherwise apply account-wide: any replacement temporary credential
   requires explicit approval of those scopes and lifetime. Never substitute a
   general account credential or print a token.
3. Choose a production Redis budget. A read-only snapshot found an 80-client
   limit, ten connected clients and zero rejected connections. That snapshot is
   not peak-load headroom evidence. `REDIS_MAX_CONNECTIONS_PER_POOL` is unset in
   production. Budget two pools per web process (one shared binary cache/limiter,
   one quota/text), plus workers, schedulers and operational headroom. A cap of
   two is the conservative sandbox-tested starting point; verify normal website
   latency as well as MCP latency before raising it. Keep gateway concurrency at
   its measured default of twenty.
4. Check current source coverage and offer freshness again. The read-only
   preflight found versioned offers in all seven NHL ingestion buckets and full
   SOG/attempts ranking inputs for all 32 teams. This differs from sandbox's
   incomplete attempt coverage; neither observation authorizes ingestion writes
   or a backfill. Player/side availability remains quote-specific.

## Authorized promotion order

1. Deploy the accepted backend first through its ordinary production workflow,
   with `STATS_API_PROP_EVIDENCE_ENABLED` still off. Apply only the approved Redis
   cap. Wait for each Heroku config release to complete before another config
   mutation. Verify health, source provenance and existing protected reads.
2. Dispatch the current reviewed MCP main SHA with the accepted app SHA and
   `deploy-production`. The existing first-attempt/main/owner-runtime gates run
   before the human production environment approval. After approval, both targets
   use bounded exact-source download, one Sources reservation, one credential-free
   S3 upload and one checksum-pinned build. Production rechecks approval and owner
   acceptance after staging; failures never cause an automatic mutation retry.
3. Reconnect the actual launch clients to refresh the tool catalog. Perform a
   small authorized Desktop/Claude check if those are advertised launch clients;
   do not reuse a customer's connection or permanent smoke credential. The
   unchanged `stats:read` scope does not by itself require every user to consent
   again, and no local plugin/connection is silently switched.
4. Enable evidence only during the approved monitored window and run the SOG
   recipe through an authorized production test connection. Current Stats API,
   agent and OAuth eligibility modes are all-access. The evidence flag is global
   within those existing policies: a true feature-specific owner canary requires
   an additional allowlist implementation. Never narrow existing global gates
   just to create a canary and accidentally disable existing customers.
5. Watch per-call latency, complete response bytes, cache hits, quote age, capacity
   rejections, Redis connections/rejections and DB activity without logging
   payloads. Verify rates/logs remain usable with missing or started-game prices.
   Turn the evidence flag off first if the rollout fails; that hides the evidence
   capability through API discovery. A runtime rollback remains a separate
   authorized operation.

The hosted skill update is a separate distribution operation. Direct-URL tools
receive routing hints from the server; a new npm/MCPB release is not required for
HTTP tool availability. Installed clients need their updated hosted skill for the
full recipe. Do not claim browser acceptance or skill/package publication from
the sandbox CLI result or this source PR.
