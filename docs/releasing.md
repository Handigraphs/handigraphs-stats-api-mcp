# Release the Handigraphs Stats API MCP

Releases are published from GitHub Actions. Publishing a GitHub Release whose tag
matches `v<package.json version>` validates and publishes npm, builds the Claude
Desktop MCPB, and attaches it. Merging source does not publish a package.

## Prepare 0.3.0 (currently unreleased)

1. Confirm explicit maintainer authorization to release. PR-08 alone does not authorize
   a merge, tag, npm publication or hosted rollout.
2. Complete PR-09 synthetic-account acceptance and rollout evidence against the
   compatible REST agent contract (implemented against 1.11.0). Verify scopes,
   capabilities, worker readiness and actual historical coverage in the intended
   environment. Mock tests or the read-only agent audit do not prove live research.
3. Align package/lock versions, `src/version.ts`, both plugin manifests, the Claude
   marketplace version and MCPB manifest. The Codex marketplace has no version field.
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
