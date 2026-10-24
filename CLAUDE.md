@AGENTS.md

Hosted MCP source uses the separately authorized `hosted_mcp_oauth` PR-06 lane
and its opt-in entrypoint. Follow AGENTS.md for request-local delegation,
public-only caching, conservative bounds and the unchanged local stdio setup.
Code and mocked tests do not authorize provisioning, activation, deployment,
manual merge or npm/MCPB publication.

PR-07 deployment controls and operator prerequisites are in
docs/hosted-operations.md. Source validation is offline; never dispatch a
deployment, provision credentials/resources, activate OAuth or publish a release
without separate explicit authorization. Production requires the owner
acceptance file and a runtime identical to its accepted MCP commit (owner
decision 2026-10-24); a runtime change needs a new owner decision.

Synthetic denial-witness instrumentation is separately authorized source only,
default off, fixed-sandbox and capped to a four-hour window and 100 events.
Follow AGENTS.md and docs/hosted-operations.md; never turn source tests or a
native disconnected state into bearer-401 evidence. This source pair needs fresh
acceptance. The pinned SDK 1.32.1 hosted-only 10,000-element guard supplements
the existing body-byte limit and leaves the local stdio setting unchanged.
