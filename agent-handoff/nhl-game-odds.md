# NHL game odds MCP read

- Branch `codex/nhl-game-odds`
- Base `d6a2201e781ba928f18522ad64def2bf0e4aadb2`
- Active writer Codex Desktop on Windows in an isolated worktree
- Dependency NHL Stats API `game_odds` contract 1 at `/api/v1/nhl/game-odds`

Both transports expose `get_game_odds`. Each call requires compatible NHL
discovery and makes one same-origin authenticated GET. A page is a single JSON
text block capped at 3,584 UTF-8 bytes. Older or disabled APIs keep their
existing tools and receive a bounded unavailable result for the odds call.

The full local MCP profile passed (189 tests passed, two skipped). Mock
official-client coverage includes absent and forged discovery, cursor
forwarding, null books, and multibyte overflow. Hosted sandbox verification
requires the compatible Stats API rollout and fresh sandbox odds data.
