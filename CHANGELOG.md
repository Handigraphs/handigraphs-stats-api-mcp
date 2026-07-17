# Changelog

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
