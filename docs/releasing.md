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
   `src/version.ts`, the local and hosted plugin manifests, Claude
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

## Hosted plugin availability

`handigraphs-stats-api-hosted` was released on 2026-10-25 by making its Codex
marketplace entry `AVAILABLE` and updating both manifests, the Claude marketplace
description and the skills. It needs no npm, MCPB or tag: Codex and Claude Code
read the marketplace from this repository's `main`. Its server is the production
gateway at `https://mcp.handigraphs.com/mcp`, deployed separately under the owner-acceptance
gate in [hosted operations](hosted-operations.md); plugin, marketplace, skill and
README changes are distribution-only and never change the gateway runtime.

Keep the local plugin, sensitive-key setup and stdio MCPB supported, without
automatic migration or a remote Claude Desktop bundle. Client caches may require
reconnect or a new conversation, and installed skills need a plugin update after
skill changes. One chosen connection at a time avoids duplicate tools, and
switching to local remains the user's choice.
