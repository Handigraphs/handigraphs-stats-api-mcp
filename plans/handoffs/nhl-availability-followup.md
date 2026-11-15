# NHL availability companion adapter

Writer: Codex root, Windows desktop, sole writer. Branch codex/nhl-availability-followup
from canonical53f543f6bd3f576fdc9f463367d3afe1c5f15102; app companion starts
at97a8a4c9221238efa79903f56f6b09da9f0c1fec. Separate fresh worktrees; prior
operations and original checkouts preserved. Open dependency PR37 is unrelated.

Approved scope: recognize advertised adaptive whole-game goalie pagination and
validate its coverage/continuation while retaining old API support; expose optional
max_candidates_per_game1..12 only for advertised v4 shortlist support, with strict
cap/uncapped-rank/count validation and no silent ignored selector. Preserve current
uncapped rank, one protected GET per tool call, text budgets, old formats and no
automatic retries. Explain upper-bound counts, explicit byte_limited/cursors, and
opaque Gamecenter handles versus league_game_id. Update shared local/hosted guidance
and safe catalog identity, keeping packaging descriptions aligned. No generation,
probability/EV/payout ranking, package publication or deployment gate change.

Validate through fresh official SDK fixtures and full MCP profile including
distribution/MCPB checks. Backend API1.27 deploys before negotiated adapter. Live
sandbox source pair/Redis/OAuth and actual client acceptance remain separate from
fixtures; new exact-pair owner record required before production, plus native
human gate. Status: implementation and focused SDK tests complete.23 official-client tests
pass for old/new representations, capped continuation and adaptive goalie pages;
TypeScript passes. Full packaging/profile validation follows. No runtime/account
mutation.
