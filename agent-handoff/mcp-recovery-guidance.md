# MCP recovery guidance

- Branch `codex/mcp-recovery-guidance`
- Base `846e61133ad32aed5628b25bae43d6238013dd88` on canonical MCP `origin/main`
- Code checkpoint `fab5d13632778ce8664b994df671c61ac4430038`
- Writer Codex desktop on Windows in an isolated worktree
- Dependencies Existing Stats API skater market discovery and Gamecenter section discovery. No app or REST contract change.

The adapter now gives valid recovery inputs for prop market keys, Gamecenter section selectors, and sort direction. The Gamecenter recipe uses analysis followed by a bounded evidence request. The MCPB tool description matches the runtime schema.

On Node 22, the full test suite passed with 182 passes and two skips. The production dependency audit, typecheck, build, hosted entrypoint build, npm pack, distribution parity, and MCPB checks passed. Official SDK regression tests use mock REST and confirm that the invalid inputs make no protected request, followed by successful valid replacements.

The connected Claude Desktop client can replay the current hosted release. Source recovery tests use the SDK until the patched runtime is available on that connection. Client truncation is tracked separately from complete SDK result size. Compact packet design, REST data additions, and hosted rollout are separate work.
