# NHL research v2 final operations

Writer: Codex root, Windows desktop, 2026-11-14. Branch
`codex/nhl-research-v2-rollout`, base/runtime
`f9d9b4a5c87cb6eb306fdc897b329e2101352d09`. User explicitly approved #56;
its merge and sandbox deployment 43652317376 succeeded. Merged source worktrees
closed cleanly; original dirty application checkout preserved.

Native Claude.ai baseline completed 11 protected reads (one 413), plus four
client-cancelled attempts. It disclosed stale sources, unknown/missing game odds,
injury risks and mixed books, with no modeled probability/EV claim. It still made
one categorical correlation statement unsupported by source evidence. Its
five-player/all-section 413 reproduced the guidance flaw corrected in #56.
Focused follow-up recovered duration=season to the actual split=season recipe.
Later evidence returned disabled-capability 503 after the finite sandbox test
window automatically restored flags; no unchanged retry was run. Gamecenter
contained no published packet for that date, and a pending packet call was
client-cancelled. These are incremental observations, not final-pair acceptance.

Native saves screening also exposed old projected rows still labeled today.
Read-only sandbox SQL found 11 Nov12 today rows alongside 14 current Nov14 rows.
The application repairs shared goalie/skater date predicates and moves its
contract/cache namespace to 1.24.1. Full 5626 app tests and three real PG tests
passed; read-only readers now have 28 unique goalies and 504 unique skaters.

Operator-only browser harness now accepts HANDIGRAPHS_EXPECTED_API_CONTRACT
explicitly (historical default 1.24.0). It remains an exact assertion, not a
wildcard. No runtime changes after f9d9b4a. Syntax check pending; final app deploy,
fresh five-owner cold OAuth, refreshed native-client acceptance and production
owner/native gates remain. Historical owner records are unchanged. No publication
or production activation. Credentials/wire traces remain absent from evidence.
Checkpoint pending commit and remote verification.
