# NHL research v2 live acceptance

Branch codex/nhl-research-v2-acceptance; active writer Codex root, Windows desktop.
Base/runtime 4c00b72ba6f9799cd6000e2ee19826a8b8a6bebe (merged PR55); app pair
ea8f5e0a989d1ed4afa1fa25a60af9a1a5938a8d (merged app PR884). Source worktrees
were clean/pushed and removed after merge. Original app checkout remains dirty
and untouched. User explicitly approved PR55 merge and sandbox deployment.

Sandbox deployment 43645536379 succeeded; app deployment 43645053582 and exact
app L4 43645350901 succeeded. No production change or package publication.
Native Claude.ai is available using its existing sandbox connector at the exact
fixed endpoint. Refreshed UI catalog shows v2 brief and date-only injury guidance;
no native protected stats call yet, preserving the cold-first cohort test.

First five-owner browser/SDK cohort reached all five ready clients but failed an
assertion. All five fresh key digests verified; exact fixture cleanup and flag
restoration succeeded, recovery journal removed. Coordinator hid the failed
assertion details; improve safe diagnostics before another run. Do not claim
acceptance from a warm retry or change historical owner acceptance records.

Private reports remain local under the workspace's separate research-v2 evidence
directory; credentials never written. Only safe aggregate summaries may be
checkpointed. Remaining: diagnose cohort, native original-prompt benchmark and
advertised sections/selector checks, then fresh owner/production gates.

Follow-up checkpoint: diagnostics retain only safe client observations and named
assertion stages; an empty qualified slate uses a separate real-player screen to
test evidence invocability. These operator-only files do not change runtime.
Gateway result metrics independently showed first tool durations 5632–7226 ms,
above target; no logical tool errors were observed. App #885 shares canonical
game certification, and #886 coalesces offer grouping while rechecking quote age
on every request. Final app candidate is now
`5d3d0e0797a1b24a5fba90065d8ef251d7ca292d`; its sandbox deployment is pending.
Rerun with deployed MCP runtime `4c00b72ba6f9799cd6000e2ee19826a8b8a6bebe`.
Historical owner acceptance remains unchanged. No production or publication.

Attempt 02 on app `5d3d0e0` / gateway `4c00b72`: five fresh owner digests,
cold p95 4042 ms, warm p95 2106 ms, max complete result 31452 bytes, no unexpected
429/503; all evidence sections and two refresh rotations passed for every owner.
Two browser revocation checks timed out, three completed UI revoke -> gateway401
and invalid_grant. Overall failed; exact cleanup and flag restoration succeeded.
Added status-only account/revoke diagnostics and separate UI stages. Coordinator
retains safe latency observations even when a later client check fails.

Actual Claude.ai with the refreshed sandbox catalog reproduced a five-player,
all-sections 413 and recovered using fewer sections/players. Its evidence tool
description still told it to omit season history. Correct that description to
request same-line season context for priced recommendations, and explain the
8 KiB budget and focused follow-ups. This changes runtime metadata: final
acceptance must name the newly deployed gateway SHA, never relabel `4c00b72`.
Full adapter profile passed (209 tests, two platform skips), production dependency
audit zero vulnerabilities, typecheck/build/pack/distributions/MCPB checks passed.
Initial test failures were two expected old-description assertions, updated to
the corrected guidance. New PR/merge approval and sandbox deployment pending.
