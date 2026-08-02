# Changelog

## Unreleased

- Start the Codex MCP server in setup-only mode when its key is missing and expose an argument-free `configure_api_key` tool that launches the password-masked Windows setup window.
- Accept both `hg_test_` rollout keys and `hg_live_` production keys in the masked Windows setup window.
- Route `hg_test_` keys to the sandbox Stats API automatically while keeping `hg_live_` keys on production.
- Add a dedicated Codex setup skill, expose **Connect my Handigraphs account** as a starter prompt, and explicitly forward `HANDIGRAPHS_API_KEY` to the plugin MCP process.
- Add a user-focused Codex setup guide covering install, update, rotation, and troubleshooting without requiring users to write PowerShell or edit Codex configuration.
- Require and document the latest Codex CLI before marketplace installation, with platform-specific credential guidance and restart behavior.
- Make npm package and MCPB validation portable across Linux and Windows, and run both
  platforms in CI.
- Resolve the transitive Hono static-serving advisory in the locked production tree and
  gate CI on a clean production dependency audit.

## 0.2.0 - 2026-07-17

- Add a public Codex marketplace plugin backed by the existing local stdio package.
- Add a Claude Code marketplace plugin with sensitive key configuration.
- Add a public, user-facing skill for resource discovery, focused queries, pagination, and safe result interpretation.
- Add a self-contained Claude Desktop MCPB manifest plus reproducible validation and packaging scripts.
- Build and attach the MCPB artifact during tagged GitHub releases.

## 0.1.0 - 2026-07-17

- Publish the stdio MCP package with live resource discovery under Apache-2.0.
- Add `list_resources`, `describe_resource`, and paginated `query_stats` tools.
- Add credential isolation, URL/redirect validation, recursive redaction, discovery caching, and safe problem-response mapping.
- Bound declared and streamed upstream JSON bodies before parsing.
- Add mocked REST, official MCP client/stdio, type, build, and package-content validation.
