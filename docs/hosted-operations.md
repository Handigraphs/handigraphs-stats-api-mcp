# Hosted MCP operations

This is a deployment-source contract, not a deployed endpoint or launch sign-off.
PR-07 creates no apps, domains, secrets, environments, registrations or releases.
The private `hosted-mcp-oauth-evidence.yml` workflow belongs to the application.
Production now uses the owner acceptance gate below (owner decision 2026-10-24);
without a valid acceptance file and identical runtime, production preflight
**fails closed**. Mock tests and a green MCP build never substitute for acceptance.

## Production gate: owner acceptance (owner decision 2026-10-24)

The hosted sandbox acceptance was completed on 2026-10-23/24 with every check
observed and passed on app `3dd38c34` / MCP `a2909a6e` (validated record sha256
`5fb155e7...`). Publishing it through the private evidence workflow was blocked
only by a stray gitlink on app main, removed in `b38cc79e` with no runtime change.
The owner (cjbuskey) chose a recorded sign-off over another campaign.

Production deploys therefore no longer read the private evidence artifact,
approval issue, sandbox releases or app main. They require all of:

1. `deploy/owner-acceptance.json`: canonical, owner `cjbuskey`, naming the tested
   app and MCP commits, the accepted app SHA (the `app_sha` input must equal it),
   the accepted MCP runtime commit, the record digest and client versions.
2. Main-only, first-attempt `workflow_dispatch` with confirmation `deploy-production`.
3. A deployed commit whose runtime is identical to `accepted_mcp_sha`: the GitHub
   compare from that commit may only touch `.github/`, `docs/`, `plans/`, the
   acceptance file, the gate script, its test, `AGENTS.md`, `CLAUDE.md`, or the
   distribution-only `plugins/`, `.agents/plugins/`, `.claude-plugin/`,
   `README.md`, `CHANGELOG.md`, `scripts/check-distributions.mjs` and
   `tests/hosted-distributions.test.ts` (added 2026-10-25 for the plugin release). Any
   change under `src/`, the package manifests, lockfile, Procfile or build inputs
   fails closed and needs a new owner decision.
4. The native GitHub `production` environment approval, rechecked after the wait.

The accepted runtime is the tested commit plus owner-approved non-breaking
security updates (zod, body-parser, fast-uri, ip-address, qs). The sandbox
target is unchanged. Runtime OAuth activation remains a separate operation.
The private PR-09 interface below is retained for reference and future releases.


## Optional synthetic revocation-denial witness

This instrumentation is default off. Source does not authorize its configuration,
deployment, fresh synthetic account creation, native login/read/revocation, or any
production operation. A changed runtime app/MCP pair requires fresh acceptance;
earlier pair results cannot be relabeled. The SDK is pinned to 1.32.1, with the
hosted-only `maxToolInputElements=10000` validation guard alongside the existing
128 KiB byte bound. Stdio keeps its previous element-limit default.

Only the exact sandbox app `handigraphs-mcp-sandbox`, resource
`https://mcp-sandbox.handigraphs.com/mcp` and issuer
`https://handigraphs-sandbox-web-49829810d1bb.herokuapp.com` can opt in. The
optional runtime variables share prefix `HANDIGRAPHS_MCP_DENIAL_WITNESS_`:

| Suffix | Required value |
| --- | --- |
| `ENABLED` | Exact `true`; missing/false/invalid configuration is inert. |
| `RUN_REF` | Fresh noncredential 64-character lowercase hexadecimal reference, never a token or token-derived digest. |
| `STARTED_AT`, `UNTIL` | Exact UTC `Z` timestamps (seconds or milliseconds), positive window of at most four hours. Requests and completed responses must be within it. |
| `EVENT_CAP` | Explicit integer 1 through 100; process-local output budget. |

The application independently requires its matching run/cohort/configuration,
fresh noncustomer owner/client/grant/access records, future access expiry and
confirmed grant revocation. Its shared Redis run budget/dedupe must be prepared
under separate operator approval and remain available; missing or ambiguous
audit state produces no confirmation. This application budget is authoritative
across gateway processes/restarts; the gateway also limits its own output.
The reviewed fresh-fixture operator must journal and perform the application's
one-time NX seed of `oauth:denial-witness:v1:<run_ref>`: only canonical `start`
and `until` epoch-millisecond strings plus `cap`, with absolute expiry at `until`.
The application's fixed seed script rejects an existing run. Requests never
seed/recreate a missing key, and the gateway never connects to Redis. Lost or
evicted state blocks evidence; do not replay a seed to reset the budget.

For each authenticated protocol request, the gateway creates a cryptographic
UUIDv4. It ignores incoming acceptance/request IDs, and sends only its generated
`X-Handigraphs-Acceptance-Request-Id` and configured
`X-Handigraphs-Acceptance-Run-Ref` on the existing fixed, service-authenticated
HTTPS `/oauth/token` exchange. No redirects, new endpoint or new audience is
introduced. No acceptance header is added to native client configuration.

Confirmation requires the ordinary OAuth `400 invalid_grant` response plus all
three exact internal response headers: `X-Handigraphs-Acceptance-Witness` equal to
`revoked-grant-v1`, and both request-ID/run-reference echoes. Only after the
gateway response actually finishes HTTP 401 does it emit one bounded JSON line
to stderr: `schema_version=1`, `event=hosted_mcp_denial_witness`, `run_ref`,
`request_id`, `status=401`, `response_finished=true`, and UTC `observed_at`.
It logs no token, credential digest, grant/client/account identity, header, body
or error. Confirmation headers never reach the MCP client. Missing/mismatched
confirmation, other statuses, unfinished/aborted responses, expired windows,
exhausted budget or output failure yield no usable witness and do not change the
normal authorization denial. Logs do not prove remote ingestion or client
cache behavior; acceptance must correlate both complete server events and the
actual native attempt within the approved window.

## Fixed proposed targets

| Target | Heroku app | Resource / readiness |
| --- | --- | --- |
| Sandbox | `handigraphs-mcp-sandbox` | `https://mcp-sandbox.handigraphs.com/mcp` / `/health/ready` |
| Production | `handigraphs-mcp` | `https://mcp.handigraphs.com/mcp` / `/health/ready` |

These names/domains are proposals whose availability, ownership and TLS must be
verified by the operator before use. There is no caller-supplied app, host, URL or
command. Both apps are separate US-region Node services; the gateway needs no
attached Postgres/Redis and never connects directly to the application database.
The existing application owns accounts, grants, quotas, queues and research.

`Procfile` starts only `npm run start:hosted`; the npm bin still starts local
stdio. `engines.node=22.x` pins the service major. The normal Heroku Node buildpack
installs build dependencies, runs `heroku-postbuild` (`npm run build`), then prunes
development dependencies. The operator must use that buildpack and leave build
dependencies available during compilation. Nothing hooks npm/MCPB publishing or
changes the package version. A source merge is distinct from a build, runtime
deployment, OAuth activation, client acceptance and package publication.

## Separate operator prerequisites

Every provisioning, credential/environment change, workflow dispatch and
activation needs its own explicit authorization. Install real values through the
approved secret channel; never paste values into chat, workflow inputs, files,
logs or process arguments. Do not modify a committed `.env`.

For each app, separately configure `NODE_ENV=production`,
`HANDIGRAPHS_HOSTED_ENABLED=true`, exact `HANDIGRAPHS_MCP_RESOURCE_URL`, application
origin `HANDIGRAPHS_OAUTH_ISSUER`, and independent environment-specific
`HANDIGRAPHS_MCP_SERVICE_CLIENT_ID` / `HANDIGRAPHS_MCP_SERVICE_SECRET`. The application
must have the matching separately installed confidential-client secret hash,
issuer, MCP/API audiences, pepper/signing keys, eligibility/cohort gates and
OAuth-capable worker readiness. No customer API key belongs in the gateway.
Heroku supplies `PORT`. Do not enable the loopback test switch on a hosted app.
Keep exact Host/Origin allowlists and conservative source defaults unless an
authorized measured rollout justifies changes. Readiness is local process/config
readiness; it does not prove an eligible connection, healthy worker or capacity.

Set up the repository environments `sandbox` and `production`; production must
require a human reviewer. The workflow independently checks the current run's
review history for an approved human `User` in `production` before any build
mutation. Empty/unprotected, bot-only or rejected histories fail, even if GitHub
allowed the job to start. Reruns are rejected: dispatch a new run so approvals
cannot be reused from a previous attempt. No script approves a gate.

Provision the following separately and restrict access to the intended jobs:

| Configuration | Purpose |
| --- | --- |
| Repository variable `HOSTED_SANDBOX_DEPLOY_ENABLED` | Exact `true` enables sandbox workflow; missing/false means no deployment, including manual runs. |
| Environment secrets `HEROKU_MCP_SANDBOX_API_KEY`, `HEROKU_MCP_PRODUCTION_API_KEY` | Separate least-privilege deploy authorizations for only their fixed app; never reuse the customer/web credential. |
| Repository variable `HOSTED_EVIDENCE_APP_CLIENT_ID` and secret `HOSTED_EVIDENCE_APP_PRIVATE_KEY` | Approved GitHub App installed only on the private application repository. The pinned official token action mints short-lived one-repository Actions/Contents/Deployments/Issues **read** tokens, revokes them after each job, and never uses the public repository's token for private access. |
| Secret `HEROKU_SANDBOX_READ_API_KEY` | Separately authorized read-only Heroku OAuth authorization restricted to inspecting the two sandbox apps' releases/slugs. A secret's name does not restrict its permissions; a normal account API key is privileged and is not an acceptable substitute. |

The App-minted path deliberately avoids guessing the permissions of an arbitrary
supplied PAT. The installed App must separately have Issues read permission; requesting it in
source does not provision or approve that access. No App installation/key or
Heroku authorization is created here.
Missing/unavailable private access blocks deployment. GitHub Actions' default
public-repository token has no private application access.

## Deployment sequence and trust boundary

1. Review and merge source through the normal all-platform `test-build-pack` gate.
2. With separate operational approval, opt in sandbox. Main pushes deploy only
   when the variable is exact `true`; a manual main dispatch additionally requires
   confirmation `deploy-sandbox`. No release or tag triggers deployment.
3. Every workflow checks repository, main ref, first run attempt and full lowercase
   40-hex source SHA. The MCP SHA must equal both the workflow-source commit and
   freshly fetched public main. Checkout uses `github.sha`, never a user ref.
   Stale or superseded runs fail; dispatch the current reviewed main revision.
4. The source-validation job has no operational secrets. It installs and runs the
   full package/test/build/distribution checks. Separate credentialed jobs install
   no package dependencies and execute only the pinned dependency-free control
   script. They never execute PR/fork source with deploy credentials.
5. The Build API receives only the public canonical repository's exact-SHA archive
   and matching source version. There is one build POST, no mutation retries and no
   credential in the archive URL. Polling reads only fixed build/release endpoints;
   build logs, signed source links and raw API responses are never printed.
   The build has an eight-minute polling budget, each API/body a 15-second bound,
   and readiness gets a further 90-second read-only polling budget. A successful
   build alone is insufficient: the latest release's slug commit and fixed-host
   readiness must match. A timeout after a release may mean deployment happened;
   inspect the actual release before any further mutation.
6. For production manually select main and supply exact `mcp_sha` (current main),
   the accepted `app_sha` from `deploy/owner-acceptance.json`, and confirmation
   `deploy-production`. The owner acceptance preflight must pass before the
   production job reaches its human environment gate.
7. After that gate, recheck current main, the owner acceptance and the runtime
   comparison. A runtime change, malformed acceptance, moved main or absent
   approval blocks the build. Production never falls back to a build status,
   caller success boolean or old preflight result. Runtime OAuth activation
   remains a separate operation.

## Private PR-09 evidence interface

The fixed source is private `cjbuskey/handigraphs-app`, workflow
`.github/workflows/hosted-mcp-oauth-evidence.yml`. The gate discovers the latest
successful main `workflow_dispatch` for the exact app SHA and independently reads
the run. Require the fixed workflow ID/path, original repository/head repository,
matching SHA, completed/success, first attempt and freshness within seven days.
The private application evidence gate uses the v2 issue-approval protocol below,
not native private-environment approval history. There is no v1/native fallback.
The public MCP production deployment still requires its existing native
`production` environment approval, unchanged and independently rechecked.

Require exactly one non-expired artifact named `hosted-mcp-oauth-acceptance`,
at most 64 KiB compressed, whose API provenance binds the same run, repositories,
branch and app SHA. Authenticate the downloaded ZIP against the API's SHA-256
digest. Follow exactly one API-issued HTTPS artifact redirect to GitHub's artifact
storage without forwarding Authorization; no further redirects. The ZIP contains
only `evidence.json`, a regular member of at most 16 KiB, stored or deflated. No
archive files are extracted or executed.

`evidence.json` is one canonical JSON object: recursively sort object keys, compact
JSON, UTF-8, followed by exactly one newline. Duplicate keys, additional whitespace,
unknown fields and noncanonical encodings are rejected. Use exported
`serializeEvidence` / `evidenceDigest` in `scripts/check-hosted-deploy.mjs` as the
interoperability reference. The exact allowed fields are:

| Field | Contract |
| --- | --- |
| `schema_version` | Integer `2` only; v1 artifacts are deliberately rejected. |
| `app_sha`, `mcp_sha` | Exact full lowercase SHA pair requested for production. |
| `checked_at` | UTC ISO timestamp within the source run and no older than seven days. |
| `source` | Only `workflow` (fixed filename), positive `run_id`, `run_attempt` (`1`). |
| `approval` | Only `method` (`github_issue_v1`), positive safe-integer `issue_number` and `comment_id`, and lowercase 64-hex `review_sha256` binding the complete private observation record. IDs stay private. |
| `sandbox` | Only `app_release`, `mcp_release`, both `v` followed by positive integer. |
| `clients` | Only `codex_desktop`, `codex_cli`, `claude_code`; numeric dotted versions (2–4 components), optional `-alpha.N`, `-beta.N`, `-rc.N`; no free text/URLs. |
| `checks` | Exactly the keys exported as `CHECKS`, each string `passed`: Codex desktop/CLI, Claude Code, refresh, revocation, queued-job revocation, cross-user isolation, shared limits, rolling-worker compatibility, local stdio, tool refresh and measured capacity. |
| `metrics` | Nonnegative safe integers only: `duration_seconds` (300–3600), `requests_per_second` (5–10, conservatively rounded down), `concurrency` (10–20), `added_p95_ms` (rounded up, below 500), `unexpected_429`, `unexpected_503` (both zero). Explained expected limits belong in private evidence; unexpected responses block this version. |
| `cleanup` | Literal `true` after authorized synthetic cleanup. |
| `evidence_sha256` | SHA-256 lowercase hex of canonical compact JSON **without** this field and **without** the final newline. This inner content digest is separate from the API-provided archive digest. |

### Independent private issue approval

Reconstruct this exact request from the verified artifact and authoritative source
run, never from caller URLs, input booleans or a claimed approval timestamp:

```json
{"schema_version":1,"purpose":"hosted-mcp-acceptance","repository":"cjbuskey/handigraphs-app","workflow":"hosted-mcp-oauth-evidence.yml","run_id":77,"run_attempt":1,"app_sha":"<full app SHA>","mcp_sha":"<full MCP SHA>","review_sha256":"<observation SHA256>","created_at":"<source run.created_at>"}
```

The example placeholders are explanatory, not accepted values. Hash recursively
sorted, compact UTF-8 JSON **without** a newline. The issue body is exactly
`approvalIssueBody(request)` in the control script: fixed review instructions,
canonical request in a JSON fence, and exact `APPROVE <request-digest>` /
`REJECT <request-digest>` commands. The shared synthetic golden fixture is
`tests/fixtures/hosted-approval-contract.json`; it is not real acceptance evidence.

Using only fixed private-repository GETs, independently re-fetch the issue, its
complete bounded comments page, and the pinned comment. The issue must remain
open, must not be a PR, must have the exact body and `41898282`/`Bot` creator.
Only the fixed owner `39887731`/`User` (cjbuskey) can approve; agents never approve.
After trimming surrounding whitespace, commands must match exactly; the pinned
ID must be the highest-ID approval for this request. Any owner-edited
comment or exact rejection, missing/deleted/changed approval, changed request or
closed issue blocks publication and future use. Non-owner comments do not approve.
Refuse pagination (`Link`) or 100+ comments rather than truncate hidden rejections.
Re-fetch both current main refs and the approval after the bounded sandbox
release/health probes, so changes during those reads block preflight too.
Missing Issues access fails closed; the external verifier never writes an issue
or comment and receives no Issues write permission.

Require `approval.created_at + 300 seconds <= checked_at <= run.created_at +
1800 seconds`. These are historical publication bounds, not a requirement that
production consume evidence within 30 minutes. The existing source-run bounds,
seven-day freshness, exact source pair and artifact expiry checks still apply.
Keep the approval issue open through evidence use/expiry; a rejection invalidates
it permanently for that request, so use a new reviewed dispatch when needed.
No `approved_at` or operator approval boolean is accepted in the artifact.

The application evidence workflow must enforce real clients, measured results,
operator approval and cleanup before publishing this allowlisted object. An object
claiming passed checks is not independently trusted. The gateway gate additionally
queries the actual latest sandbox releases and slug commits for fixed
`handigraphs-sandbox-web` / `handigraphs-mcp-sandbox`, requires their versions and
SHAs to equal this manifest, and checks backend database/Redis readiness plus MCP
readiness over fixed HTTPS origins. Only source SHAs and the redacted evidence
digest are printed publicly. Never upload the private manifest, logs, raw browser
traces, signed download URLs, account IDs, passwords or credentials to public CI.
No authenticated transcripts or real customer data belong in this interface.

## Health, rollout and rollback

Probe `/health/live` and `/health/ready` without credentials, using the configured
canonical host and bounded nonredirecting HTTP. Do not anonymously invoke a
protected tool to infer health. Validate the actual source/release pair and real
clients separately. Preserve the backend's existing quota, cohort and worker gates.
Do not recommend or publish the hosted default until PR-09 and explicit launch
approval; the local stdio plugin and key setup remain supported.

For an authorized rollback, first stop new hosted authorizations/submissions in the
application, revoke/suspend affected hosted grants, and drain/cancel OAuth research
under a worker that understands contracts 5/6. The gateway drains short requests
on SIGTERM. Roll the gateway independently to a previously verified compatible
release only with explicit operational authorization; this workflow does not
provide an arbitrary old-SHA bypass. Never revert workers to 1–4 while OAuth jobs
are active, drop additive schema/tombstones, clear shared Redis, rotate personal
keys or delete saved objects as rollback. A failed deployment does not authorize
an automatic rollback, secret rotation, redeploy or flag change.

The plan's 2026-10-17 public list-price baseline is $25/month Standard-1X production
plus $7/month Basic sandbox ($32/month incremental); two production instances plus
sandbox would be $57/month. This is an unmeasured planning scenario, not a current
quote, capacity promise, purchase or API/LLM bill. No scaling or data upgrade is
implied. Measure existing shared database/Redis/worker headroom before rollout.

Primary implementation references: [Heroku Build API](https://devcenter.heroku.com/articles/build-and-release-using-the-api),
[GitHub workflow runs/review history](https://docs.github.com/en/rest/actions/workflow-runs),
[artifact provenance and downloads](https://docs.github.com/en/rest/actions/artifacts),
and the pinned [official scoped token action](https://github.com/actions/create-github-app-token/tree/64ab729a6294000f5aa4a4bc0b73d1f32bc45510).
