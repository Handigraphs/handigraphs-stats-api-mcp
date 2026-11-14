# NHL research v2 adapter

Branch codex/nhl-research-v2, base c735ab3a0c9aa7fca4608bcd3a4c75626b84cc05.
Active writer Codex root on Windows, dedicated worktree. Paired backend branch
codex/nhl-research-v2 starts at app 2b9cf939. User approved implementation of the
November 14 plan: compact-v2 negotiation, priced research policy, named injuries,
date-only slate injury reads, compact discovery, existing goalie-screen recipe,
Gamecenter compact selector compatibility and explicit broad opponent cohort.

Keep v1, both transports, pinned discovery paths, quotas/redaction and no-retry
semantics. No package publication or production acceptance is inferred from code.
Source changes need a fresh sandbox source pair and actual Claude.ai test, plus
normal owner/runtime and native human production approval before promotion.

Status: runtime implementation is ready for review; acceptance harness in progress.
Negotiates compact_v2 only when advertised, retains v1, supports date-only injury
pages and exact opt-in paired price arithmetic, compact metric discovery, existing
goalie prop_screen recipe, Gamecenter format=compact alias and safe logical-result
metrics. No authentication/scope policy or transport switch. Existing dependabot
PR37 is unrelated.

Validation: latest 209 tests passed/2 platform skips (rerun after final compact
projection). Typecheck/build, production dependency audit, pack and MCPB passed;
distribution descriptions/hashes updated and check passed. Live public discovery
with this adapter: complete skater/goalie/team compact results 14,149 / 10,388 /
14,659 bytes; no protected request or account state change. Every canonical metric
definition/unit remains; full retains benchmarks, aliases and rounding metadata.

Backend checkpoint pushed at 823d145b7958f3e039c8b582e93fc64bcdb8f05b (code
854d39d421c284108e162cf1f426f173701b0811). Subsequent finite five-owner operator
and safe input-cache evidence are not in that backend checkpoint yet. Backend
full tests 5497 passed/505 skips, 80 PostgreSQL checks and frontend checks passed;
the seven cohort/recovery PostgreSQL checks passed separately.

Remaining: final harness/source-pair validation, CI/merges and fixed-sandbox
deployment, fresh MCP-first cold/five-owner and Claude.ai acceptance. Do not
update owner acceptance or claim production readiness from these tests. The
historical accepted pair/record is untouched; no npm/plugin publication occurred.
