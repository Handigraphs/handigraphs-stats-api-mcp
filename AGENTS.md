# Handigraphs Stats API MCP agent guide

This public Apache-2.0 repository is the canonical local stdio adapter. The REST
service lives separately in cjbuskey/handigraphs-app. Use Node 22 and follow
CONTRIBUTING.md, SECURITY.md and .agents/pipeline.yml.

Use a dedicated worktree and codex/ task branch from fetched origin/main. Inspect
open PRs and preserve unrelated work. Record the active writer, base, validation,
checkpoint and remaining work in the plan's per-shard progress fragment (or a
tracked agent-handoff note for an unplanned task). Push task-scoped checkpoints.
Open a ready PR after validation; CI is test-build-pack across Linux, macOS and
Windows. There is no auto-merge or local UI gate. Merging, tagging, publishing npm
or MCPB releases and hosted changes require explicit user authorization.

Run the full mcp validation profile before requesting review. Use mocked REST
endpoints and the official MCP client. Never use a live credential without a
user-supplied temporary sandbox key held only in the process environment. Keep
stdout reserved for MCP protocol, diagnostics on stderr, and credentials out of
arguments, URLs, fixtures, logs and tool results. Preserve bounded same-origin
requests, no redirects, no automatic retries and old-server stats compatibility.
Do not introduce generic HTTP tools or hosted transports.

For agent_filter_research, the copied static plan preserves its original text.
The user's subsequent permission decision (implemented by app PRs 733/734)
supersedes its default-off wording: new and existing keys receive filters:write
and research:run by default, owners can disable either, and rotation preserves
their choices. Eligibility and rollout gates remain enforced. Permissions never
substitute for user intent: explicit create requests authorize a new save;
replacements require confirmation. PR-07 adds reads only; actions, workflow skill
and distribution version changes belong to PR-08. Publication is separate.
