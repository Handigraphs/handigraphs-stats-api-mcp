# NHL season selection in MCP

- Branch: `codex/nhl-season-selector`
- Base: `main` at `bc3cbe5950d1b97d26625d38ad6e5b6ed5fc4aae`.
- Initial code checkpoint: `2909fd88489125e77316503bdf881b27d97881d4`; the PR head also includes the approved dependency follow-up below.
- Writer: Codex delegated Windows execution session, 2026-10-06.
- Status: [draft PR #20](https://github.com/Handigraphs/handigraphs-stats-api-mcp/pull/20), locally validated, unmerged. No merge, tag, release, package publication, configuration change or deployment is authorized.
- Backend dependency: [handigraphs-app #709](https://github.com/cjbuskey/handigraphs-app/pull/709), branch `codex/nhl-api-season-selector`, checkpoint `050ef49db043101376f28328282acf3717509280`, public contract `1.6.0`. Its four CI checks passed on that exact head.

## Behavior

`query_stats({ sport: "nhl", resource: "teams", season: "20262027" })` forwards the optional season only when the selected resource's live discovery advertises it. All four NHL resources support the same eight-digit consecutive-year validation. The existing API key boundary, compact defaults, pagination forwarding, transport and metadata pass-through are unchanged. Omitted `season` remains omitted and retains the REST server's default.

The matching REST change is required before explicit NHL seasons work against production. Current REST discovery does not advertise the selector; this adapter returns an input error without a protected request in that situation. Current/prior seasons and the default cannot share a REST cursor. A selected season changes statistics only, retaining the current slate and existing split/mode behavior. Eligible goalie/skater identities with missing statistics, empty source results and null freshness are preserved; no prior-season or preseason substitute is manufactured.

README, the packaged query skill and an Unreleased changelog entry describe this additive behavior. Distribution and package versions remain `0.2.6`; this branch is not a release.

## Validation

- `npm test`: **33 passed, 2 platform-specific skips**; includes official MCP client tests over the in-memory transport for all four NHL resources with explicit current, explicit prior and omitted selections; older discovery and malformed input issue no protected request. Existing MLB and stdio tests pass.
- `npm run typecheck`, `npm run build`, `npm run pack:check`, `npm run distributions:check`, `npm run mcpb:check`, and `git diff --check` passed on Node 22.
- The initial dependency audit and CI failed on five existing vulnerable transitive packages. After explicit user approval, a temporary lockfile-only trial changed exactly those five entries, with no package additions/removals or changes to `package.json`, root requirements, versions or audit policy. Registry-resolved updates are `fast-uri` 3.1.5 to 3.1.8, `hono` 4.13.0 to 4.13.13, `ip-address` 10.4.0 to 10.7.3, `proxy-addr` 2.0.7 to 2.0.8, and `qs` 6.15.3 to 6.16.0. All satisfy the existing parent ranges. The updated `npm run audit:prod` reports **zero vulnerabilities**, and the complete local checks above were rerun with the new lockfile.
- No live patched API or sandbox MCP integration was available; these tests use a local synthetic REST server. Pack checks create local verification artifacts only.

## Remaining

Keep this PR a draft. Obtain approval for the matching backend's sandbox/production deployment and validate bounded live requests before a separately approved adapter release. Publishing or tagging the current branch is not part of this task. Verify the final pushed head, draft state and cross-platform CI before handoff.
