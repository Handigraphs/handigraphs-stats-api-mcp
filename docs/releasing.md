# Release the Handigraphs Stats API MCP

Releases are published from GitHub Actions. Publishing a GitHub Release whose tag exactly matches `v<package.json version>` validates the package, publishes it to npm with trusted publishing, builds the Claude Desktop MCPB, and attaches that artifact to the release.

## Prepare the release

1. Set the same version in `package.json`, `package-lock.json`, both plugin manifests, both marketplace manifests, and `mcpb/manifest.json`.
2. Move the release notes from **Unreleased** to a dated version heading in `CHANGELOG.md`.
3. Run the complete validation suite:

   ```console
   npm ci
   npm test
   npm run typecheck
   npm run build
   npm run pack:check
   npm run distributions:check
   npm run mcpb:check
   ```

4. Merge the release pull request to `main` and confirm the `CI` workflow passes on the merge commit.

## Publish 0.2.2

From an authenticated GitHub CLI session, create the published release at the current `main` commit:

```console
gh release create v0.2.2 --repo Handigraphs/handigraphs-stats-api-mcp --target main --title "v0.2.2" --generate-notes
```

This creates the `v0.2.2` tag and triggers `.github/workflows/publish.yml`. Do not run `npm publish` locally for the normal release path.

Watch the workflow in GitHub Actions, then verify both distributions:

```console
npm view @handigraphs/stats-api-mcp version
gh release view v0.2.2 --repo Handigraphs/handigraphs-stats-api-mcp
```

The npm result must be `0.2.2`, and the GitHub Release must include `handigraphs-stats-api-mcp-0.2.2.mcpb`.
