# Synthetic gateway denial witness

- Branch: `codex/hosted-mcp-denial-witness` in a dedicated external-repository
  worktree. Canonical remote: `Handigraphs/handigraphs-stats-api-mcp`.
- Base: fetched `origin/main` `ada7b208a51203705af9d7ac857b55fc443576a1`.
  No open external PR at discovery. The unrelated Windows setup branch was
  inspected for overlap and preserved; the reference checkout is untouched.
- Sole writer: Codex `graph_review`, Windows / PowerShell, Node 22.14.0.
  Application counterpart belongs to the separate application writer.
- Status: source complete, final exact validation and independent application-
  counterpart source review passed. No PR, live operation, deployment,
  publication or manual merge.
- Code checkpoint: this implementation commit; its full SHA will be recorded by
  a subsequent continuity-only commit after checkpoint creation.

## Contract and boundaries

The optional witness is default off. Invalid configuration is inert, preserving
ordinary authentication. It accepts only the exact committed sandbox app,
resource and issuer, an explicit noncredential lowercase-hex run reference,
UTC window of at most four hours, and an explicit output cap of 1 through 100.
`NODE_ENV=production` alone is not a production-target signal; Heroku sandbox
uses that runtime mode too. Actual production resource/app/issuer are excluded.

Each admitted authenticated request gets an internally generated UUIDv4. Client
request/acceptance IDs are ignored. Only the existing fixed HTTPS confidential
token-exchange request receives the generated request-ID/run-reference headers.
No client config, OAuth credential store/cache, endpoint, audience, auth semantics,
redirect policy or retry is changed.

The request-local attempt is confirmed only on ordinary `400 invalid_grant` plus
`X-Handigraphs-Acceptance-Witness: revoked-grant-v1` and both exact request-ID and
run-reference echoes. Missing, duplicate/mismatched or unknown markers, success,
scope errors, dependency failure and private-API authorization errors cannot
produce a witness. Confirmation failure leaves the same invalid-grant denial.

Only an actual finished, undestroyed HTTP 401 response still within the window
can emit the fixed event to stderr. Closed/unfinished responses, clock reversal,
expired windows and exhausted budgets yield none. The gateway emits only version,
event, run reference, request ID, numeric 401, response-finished boolean and UTC
time. No token, token-derived hash/digest, grant/client/account identity, incoming
header, body or error reaches the event or response. Output errors never change
the denial and are not retried; complete ingested JSON lines must be correlated
with the independently confirmed application event. Neither output nor mocks
prove native cache behavior, remote log ingestion or acceptance.

The application's fresh synthetic cohort, positive persisted opaque-access
lookup, future expiry, authoritative revocation and shared Redis run budget are
separate prerequisites. Its cap/dedupe is authoritative across gateway restarts;
this gateway also reserves a process-local output budget before sink work.
The application requests never create/recreate that budget: a separately
authorized fresh-fixture operator must journal and seed its exact run once NX,
with `start`/`until` epoch milliseconds, `cap`, and absolute expiry. Missing,
evicted or changed budget state suppresses confirmation, not a new budget.
Missing/ambiguous application auditing suppresses its marker. Pairing this new
runtime source with the app requires a fresh acceptance run; prior-pair results
cannot be relabeled. No operator action is performed by this task.

## Bounded SDK prerequisite

The first exact validation profile stopped at `audit:prod` exit1 on the existing
SDK 1.31.0 high-severity advisory. Parent explicitly extended ownership to exact
SDK 1.32.1 package/lock changes; no transitive versions or other packages changed.
The official registry's gitHead matches upstream version commit
[`ff07b001`](https://github.com/modelcontextprotocol/typescript-sdk/commit/ff07b001194fe60ee9deb2121cf119057565796d).

The [upstream validation advisory](https://github.com/advisories/GHSA-46jr-4wx8-v453)
requires enabling its opt-in element guard as well as upgrading. Parent approved
the narrow shared `server.ts` option: hosted servers pass 10,000 elements while
retaining the 128 KiB body bound. Stdio keeps its previous unset element default.
An actual loopback HTTP request below the byte bound but above the element bound
is rejected by the SDK before any protected REST call.

The [redirect advisory](https://github.com/advisories/GHSA-6prh-2h8m-c8cw)
changes SDK HTTP client defaults to same-origin; the gateway's exchange already
uses manual redirects. The [audience advisory](https://github.com/advisories/GHSA-rvq5-wwqv-78pq)
concerns SDK bearer middleware that this gateway does not use: the fixed-resource
confidential exchange remains authoritative. No experimental task store is used.
Actual installed 1.32.1 source/declarations were reviewed; no speculative SDK API.

## Validation and delivery

- Fresh own `npm ci`, no shared dependencies or copied environment file, no live
  credentials. All REST mocked; HTTP lifecycle uses real loopback sockets.
- Initial full test: 156 passed / 2 existing macOS-only skips; then production
  audit failed on existing SDK, stopping the exact profile. Supplemental remaining
  type/build/package/distribution/MCPB checks passed; none waived the failed gate.
- Updated full profile with SDK1.32.1 and hosted element limit: 157 passed /
  2 platform skips; audit zero production vulnerabilities; every recorded command
  exited0. Final small clock/optional-audit hardening subsequently passed all
  46 focused cases with no skips. Final exact profile rerun passed unchanged:
  `npm ci`, test (157 passed / 2 platform skips), production audit (zero),
  typecheck, build, pack, distributions and MCPB all exited0.
- Install still reports two pre-existing development advisories; no unrelated
  dependency update was attempted. Unsigned MCPB warning is expected.
- Development TypeScript fixture-narrowing errors were fixed before passing
  checks; no failing source/test gate is concealed. `git diff --check` passes.
- `.tools/` contains untracked validation logs only and is excluded from selective
  staging. No private operational output is committed.

Independent application-counterpart reviewer approved actual source/tests,
including the exact SDK delta and hosted-only opt-in guard. No extra live test
or operational acceptance was performed for review.

Remaining: create source and continuity
checkpoints, push and verify the exact remote SHA. Parent review precedes any PR;
external merge is human-controlled. Source merge is distinct from sandbox
deployment, instrumentation activation, native acceptance and npm/MCPB release.
