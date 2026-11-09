# Compact Gamecenter pagination

- Branch `codex/compact-gamecenter-pagination`
- Base `097ab6ff576603d714f0e71fe35f0481190ae888`
- Code checkpoint `b984e06e3713cf39badba28495f23741f1400075`
- Active writer Codex Desktop in an isolated Windows worktree
- Dependency Existing Stats API analysis and exact-ID evidence selectors

The MCP adapter projects the stored analysis into opt-in `format: "compact_page"`
results. The 3,584-byte UTF-8 limit applies to the JSON text displayed in the
tool result. Each page has its own citation index, the existing evidence link,
and a cursor bound to the projected packet. An oversized whole item is identified
by section and index and can be read in the unpaged compact packet.

The full MCP validation profile passed locally with 186 passing tests and two
skips. The offline PHI–VAN replay produced eight pages, at most 3,441 bytes each,
with eight props, six reviews, and 111 distinct citation IDs. All IDs matched
recorded exact-ID evidence. The capture is outside Git.

Hosted verification is pending. The fixed sandbox workflow requires a reviewed
main commit and a sandbox deploy authorization. After deployment, follow every
page of a stored sandbox packet in Claude Desktop Chat, inspect the expanded
cards for completeness, and resolve exact citations from a prop and a market
review. Keep production acceptance on hold until that check passes.
