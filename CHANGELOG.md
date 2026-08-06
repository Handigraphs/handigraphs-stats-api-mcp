# Changelog

## 0.2.4 - 2026-08-06

- Launch the Windows masked-key helper through Codex's approved local-shell path so the setup window is visible outside the MCP sandbox.
- Stop reporting Windows setup success until the helper survives an initial launch check, and return a launch failure when Windows terminates it immediately.
- Run the Windows helper in STA mode, make its platform check independent of the inherited `OS` environment variable, and distinguish cancellation from launch failure.

## 0.2.3 - 2026-08-04

- Report the package version consistently in both normal and setup-only MCP handshakes.
- Add a sandbox-only official-client launch audit covering both sports, all nine resources, compact/default metadata, and cursor pagination.
- Expand deterministic launch coverage for structured `400`, `401`, `429`, and `503` pass-through without retries, stderr redaction, and handshake version alignment.
- Refresh the locked `fast-uri`, Hono, and `ip-address` transitive releases to patched versions required by the production dependency audit.

## 0.2.2 - 2026-08-03

- Fix the macOS masked setup dialog so its AppleScript preserves valid statement boundaries and opens reliably.
- Give the macOS helper time to surface an immediate launch failure before reporting that its window opened, while leaving the dialog independent of the MCP call once it starts successfully.
- Compile-check the bundled setup AppleScript on macOS CI in addition to validating Keychain storage.

## 0.2.1 - 2026-08-02

- Start the Codex MCP server in setup-only mode when its key is missing and expose an argument-free `configure_api_key` tool that launches the password-masked setup window on Windows and macOS.
- Accept both `hg_test_` rollout keys and `hg_live_` production keys in the masked setup window.
- Route `hg_test_` keys to the sandbox Stats API automatically while keeping `hg_live_` keys on production.
- Add a dedicated Codex setup skill, expose **Connect my Handigraphs account** as a starter prompt, and explicitly forward `HANDIGRAPHS_API_KEY` to the plugin MCP process.
- Add a user-focused Codex setup guide covering install, update, rotation, and troubleshooting without requiring users to write shell setup code or edit Codex configuration.
- Require and document the latest Codex CLI before marketplace installation, with platform-specific credential guidance and restart behavior.
- Add the same argument-free, password-masked setup flow on macOS, store its credential in Apple Keychain without putting it in process arguments, and load that Keychain item automatically at MCP startup.
- Make npm package and MCPB validation portable across Linux, macOS, and Windows, and run all three platforms in CI.
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
