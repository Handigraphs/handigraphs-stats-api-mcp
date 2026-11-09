# Compact Gamecenter packet

- Branch `codex/compact-gamecenter-packet`
- Base `70aadbbe004bf796efb3eb01d937e9d7ebb31d73`
- Code checkpoint `942981b7ed4e4502e46b73a60f78ba852e9ce0ae`
- Active writer Codex desktop on Windows in an isolated worktree
- Dependency Existing REST Gamecenter analysis and exact-ID evidence selectors

`get_gamecenter_packet` supports `compact: true` for one JSON text result.
It preserves prop and market-review text, freshness, publication state and
caveats. The citation table contains canonical IDs once. Per-item indices
point into the table, and the packet supplies one evidence section link.
Default detailed reads and evidence reads retain their existing response.
The adapter projects the existing upstream analysis response.

The local MCP validation profile passed with 184 tests and two skips.
Production audit, typecheck, build, package, distribution and bundle checks
passed. The official SDK replay through the built stdio entrypoint retained
all eight props, six reviews and 111 distinct IDs. Full tool results were
121,529 bytes detailed and 11,463 bytes compact. All 111 IDs resolved via the
existing production evidence reader. The capture remains outside Git.

Claude Code 2.1.283 connected to the isolated replay server. Its expired
Anthropic OAuth session prevented an actual tool call. The client check is
pending sign-in. This changes the hosted runtime and needs separate sandbox
validation and owner acceptance before production promotion.
