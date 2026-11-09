# Compact pagination production acceptance

- Branch `codex/compact-pagination-acceptance`
- Base and tested MCP runtime `e457b815c71bf7601e7a5001841e86cb17f0498c`
- Record checkpoint `db1375c4b01a0aa19cf6b38f10e254138cf0fa52`
- Active writer Codex Desktop in an isolated Windows worktree
- Dependency Hosted MCP #44 and app source `3d9d1f8452083371881f5cf9fe41b481df8d91fb`

The proposed acceptance record and pinned test cover the exact sandbox pair.
The deploy logs trace both web environments to the same app source. The hosted
Claude Desktop Chat replay followed all eight CBJ–BUF pages through the null
cursor and opened each card. Both sampled citation IDs returned exact facts.
See [the acceptance notes](../../docs/compact-pagination-acceptance.md).
The redacted receipt remains private and its SHA-256 matches the record.

The full local MCP validation profile passed with 186 tests and two skips.
The proposal changes only the acceptance record, documentation and its pinned
test. Owner review is pending. Production dispatch and environment approval
are separate from this PR.
