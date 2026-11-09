# MCP recovery guidance

- Branch `codex/mcp-recovery-guidance`
- Base `846e61133ad32aed5628b25bae43d6238013dd88` on canonical MCP `origin/main`
- Code checkpoint `534f92704d19119233e4e9cab51e5fd9b19816bb`
- Writer Codex desktop on Windows in an isolated worktree
- Dependencies Existing Stats API skater market discovery and Gamecenter section discovery. No app or REST contract change.

The adapter now gives valid recovery inputs for prop market keys, Gamecenter section selectors, and sort direction. The Gamecenter recipe uses analysis followed by a bounded evidence request. The MCPB tool description matches the runtime schema.

On Node 22, the full test suite passed with 182 passes and two skips. The production dependency audit, typecheck, build, hosted entrypoint build, npm pack, distribution parity, and MCPB checks passed. Official SDK regression tests use mock REST and confirm that the invalid inputs make no protected request, followed by successful valid replacements.

Claude Desktop 4.23118.0.0 replayed the current hosted release v7 (MCP 0.3.0, source `846e6113`) in a fresh chat. The tool cards showed seven calls, including two discovery calls. The analysis card displayed “Output truncated” even though the model read the requested fields and completed the replay. The three-fact evidence card showed no truncation marker. Measure complete adapter envelopes outside the Claude display. Source recovery tests use the SDK until the patched runtime is available on that connection.

The first CI run caught the outdated expected manifest digest. The digest now matches the intentionally updated tool description, and the full local suite passed again. Compact packet implementation, REST data additions, and hosted rollout are separate work.
