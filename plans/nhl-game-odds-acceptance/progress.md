# NHL game odds production acceptance

- Branch `codex/nhl-game-odds-production-acceptance`
- Base and tested MCP runtime `e5c95fe949b8132559328bb6fdb273a83046a3a2`
- Acceptance record checkpoint `81051e640584b719d613cb5c2c9b8b350deb784b`
- Writer Codex Desktop in a dedicated Windows worktree
- Dependencies app #844 and #845, MCP #46

The proposed record pins the sandbox Stats API and hosted MCP source pair.
[The acceptance notes](../../docs/nhl-game-odds-acceptance.md) cover both hosted
Claude checks, the production release state, and the promotion sequence.
The redacted receipt stays private and its SHA-256 is in the record.

The full MCP profile passed on Node 22. It reported 189 passing tests and two
skips, zero production audit findings, and successful build, type, npm pack,
distribution, and MCPB checks. Owner review is pending. Production scraper
promotion, Stats API flag enablement, and the hosted MCP dispatch with native
environment approval remain separate operational steps.
