# Release the Handigraphs Stats API MCP

Releases are published from GitHub Actions. Publishing a GitHub Release whose tag
matches `v<package.json version>` validates and publishes npm, builds the Claude
Desktop MCPB, and attaches it. Merging source does not publish a package.

## Prepare 0.3.0 (currently unreleased)

1. Confirm explicit maintainer authorization to release. PR-08 alone does not authorize
   a merge, tag, npm publication or hosted rollout.
2. Complete **agent_filter_research PR-09** synthetic-account acceptance and rollout evidence against the
   compatible REST agent contract (implemented against 1.11.0). Verify scopes,
   capabilities, worker readiness and actual historical coverage in the intended
   environment. Mock tests or the read-only agent audit do not prove live research.
3. In a separately approved release change, align package/lock versions,
   `src/version.ts`, the local and hosted candidate plugin manifests, Claude
   marketplace versions and MCPB manifest. The Codex marketplace has no version field.
   Keep all 19 normal tool names aligned; setup-only mode remains separate.
4. Move the Unreleased notes to a dated 0.3.0 heading only when preparing publication.
5. Run the complete profile on Node 22:

   ```console
   npm ci
   npm test
   npm run audit:prod
   npm run typecheck
   npm run build
   npm run pack:check
   npm run distributions:check
   npm run mcpb:check
   ```

6. Merge the release PR with explicit approval and confirm CI passes on that commit.
   Confirm the npm version is still available and select that exact validated SHA.

## Publish only after approval

From an authenticated CLI session, substitute the full validated SHA:

```console
gh release create v0.3.0 --repo Handigraphs/handigraphs-stats-api-mcp --target <validated-sha> --title "v0.3.0" --generate-notes
```

This creates the tag and triggers `.github/workflows/publish.yml`. Do not run
`npm publish` locally for the normal release path. Watch the workflow, then verify:

```console
npm view @handigraphs/stats-api-mcp version
gh release view v0.3.0 --repo Handigraphs/handigraphs-stats-api-mcp
```

The npm result must be 0.3.0 and the release must contain
`handigraphs-stats-api-mcp-0.3.0.mcpb`. Verify plugin installation and client tool
listing against that published version. Do not describe publication as complete
until both the workflow and artifact checks succeed.

## Hosted candidate publication and activation are separate

`handigraphs-stats-api-hosted` is an **unreleased, unavailable candidate**. Its
proposed `https://mcp.handigraphs.com/mcp` resource is unprovisioned by the source
work. Source entries and mocked HTTP tests do not prove a hosted deployment or
client interoperability. Codex marks the candidate `NOT_AVAILABLE`; Claude's
entry and both manifests explicitly label it unavailable candidate. Keep the
local plugin, sensitive-key setup and stdio MCPB supported, without automatic
migration or a remote Claude Desktop bundle.

Before changing the hosted candidate's availability, public recommendation or
publication, complete **hosted_mcp_oauth PR-09** real same-pair acceptance and
obtain explicit launch/release approval. This is distinct from local
`agent_filter_research PR-09` evidence and from approval to publish a local npm
or MCPB version. Neither local acceptance nor a package release proves hosted
Codex/Claude Code OAuth, capacity or worker compatibility.

Follow [hosted operations](hosted-operations.md) for separately approved app/DNS,
TLS, service credentials, environment gates, default-off sandbox deployment and
exact-SHA production provenance. No source merge enables those settings. Public
directory submission, marketplace activation, deployment, cohort activation and
tag/npm/MCPB publication require their own authorization; do not make them a
side effect of this distribution PR or the npm release workflow.

During authorized pre-release testing use the
[direct sandbox URL instructions](codex-setup.md#hosted-candidate-pre-release-testing).
Record actual Codex desktop/CLI and Claude Code versions, refresh/revoke and
tool-list behavior. Client caches may require reconnect or a new conversation;
separately installed skills may need a plugin update. One chosen connection at a
time avoids duplicate tools, and switching to local remains the user's choice.
