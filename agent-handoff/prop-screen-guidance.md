# Direct-URL prop screen guidance

- Active writer: this Codex desktop session, Windows; no delegation.
- Branch: `codex/prop-screen-guidance`; base `efa2a6203e661ac10e53469339948ebce1c99767`.
- Problem: isolated live direct-URL research made the intended two data calls, but its complete result pair exceeded 32 KiB (34,623 then 36,018 bytes). A diagnostic repeat confirmed it requested seven screen metrics, ten logs and a season summary. The source-skill recipe requested three metrics/five logs and used 30,306 bytes; the explicit SDK recipe used 30,296 bytes. The short hosted routing hint left those choices implicit.
- Change: make the hosted routing hint name the compact twelve-row SOG screen's three metrics, and steer shortlist evidence to the default five logs with no season summary unless requested. Add parameter descriptions for those choices. No validation, defaults, local stdio, credentials, dependencies or production workflow changes.
- Validation: full MCP profile passed: 174 tests passed/two existing skips, production audit zero findings, typecheck/build/package/distribution/MCPB checks green. Cross-platform CI pending. The context-budget test also checks the discoverable recipe and shortlist limits.
- Dependencies: app #838 is deployed in sandbox with L4 green; operational acceptance lives on the separate app branch `codex/nhl-prop-acceptance`.
- Remaining: full validation, ready PR, explicit user merge approval, already-authorized fixed-target sandbox deployment, then fresh finite native/SDK acceptance. Production and package/skill publication remain unauthorized.
- Code checkpoint: this commit, to be pushed and remote-verified before handoff.
