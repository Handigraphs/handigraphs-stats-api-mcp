# NHL season selection in MCP

- Branch: `codex/nhl-season-selector`
- Base: `main` at `bc3cbe5950d1b97d26625d38ad6e5b6ed5fc4aae`.
- Code checkpoint: `2909fd88489125e77316503bdf881b27d97881d4`; this note is a later documentation checkpoint.
- Writer: Codex delegated Windows execution session, 2026-10-06.
- Status: tested code pushed; draft PR requested. No merge, tag, release, package publication, configuration change or deployment is authorized.
- Backend dependency: `cjbuskey/handigraphs-app`, branch `codex/nhl-api-season-selector`, code checkpoint `e7900e33d5b621a082c49da5b70e1adc76eeba8c`, public contract `1.6.0`.

## Behavior

`query_stats({ sport: "nhl", resource: "teams", season: "20262027" })` forwards the optional season only when the selected resource's live discovery advertises it. All four NHL resources support the same eight-digit consecutive-year validation. The existing API key boundary, compact defaults, pagination forwarding, transport and metadata pass-through are unchanged. Omitted `season` remains omitted and retains the REST server's default.

The matching REST change is required before explicit NHL seasons work against production. Current REST discovery does not advertise the selector; this adapter returns an input error without a protected request in that situation. Current/prior seasons and the default cannot share a REST cursor. A selected season changes statistics only, retaining the current slate and existing split/mode behavior. Empty rows and null freshness are preserved; no prior-season or preseason substitute is manufactured.

README, the packaged query skill and an Unreleased changelog entry describe this additive behavior. Distribution and package versions remain `0.2.6`; this branch is not a release.

## Validation

- `npm test`: **33 passed, 2 platform-specific skips**; includes official MCP client tests over the in-memory transport for all four NHL resources with explicit current, explicit prior and omitted selections; older discovery and malformed input issue no protected request. Existing MLB and stdio tests pass.
- `npm run typecheck`, `npm run build`, `npm run pack:check`, `npm run distributions:check`, `npm run mcpb:check`, and `git diff --check` passed on Node 22.
- `npm run audit:prod` failed on the unchanged dependency lockfile: **5 vulnerabilities (3 moderate, 1 high, 1 critical)**, covering `hono`, `ip-address`, `qs`, `fast-uri` and `proxy-addr`. Dependency versions and overrides were not modified by this feature. The CI audit gate may block the draft independently of season-selector correctness.
- No live patched API or sandbox MCP integration was available; these tests use a local synthetic REST server. Pack checks create local verification artifacts only.

## Remaining

Keep this PR a draft. Resolve dependency audit findings separately, obtain approval for the matching backend's sandbox/production deployment, and validate bounded live requests before a separately approved adapter release. Publishing or tagging the current branch is not part of this task. Verify the final pushed head and draft state before handoff.
