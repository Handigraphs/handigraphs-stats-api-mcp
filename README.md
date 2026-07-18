# Handigraphs Stats API MCP

Public MCP server for read-only access to the Handigraphs Stats API v1. Version 0.2.0 uses stdio only and exposes three tools:

- `list_resources({ sport? })` discovers sports and resources.
- `describe_resource({ sport, resource })` discovers metrics, canonical units, splits, and supported filters.
- `query_stats(...)` validates against live discovery and queries one protected data resource. Continue pagination by passing the returned cursor back to this tool.

Sports, resources, metrics, and splits are never compiled into this package. Public discovery remains authoritative.

## Credentials

Create a reveal-once Stats API key at [handigraphs.com/account/api](https://handigraphs.com/account/api). Never paste a real key into a repository, issue, prompt, or committed client configuration.

## Install with the Handigraphs plugin

### Codex

1. Install Node.js 22 or newer.
2. [Create a named Stats API key](https://handigraphs.com/account/api) and copy it when it is revealed.
3. Open Terminal and run these commands in order:

```bash
codex plugin marketplace add Handigraphs/handigraphs-stats-api-mcp
codex plugin add handigraphs-stats-api@handigraphs
```

4. Set `HANDIGRAPHS_API_KEY` in the same shell or environment used to launch Codex. Keep the value out of source control and prompts.
5. Launch or fully restart Codex. The plugin adds the local MCP server and a `query-handigraphs-stats` skill.

### Claude Code

1. Install Node.js 22 or newer.
2. [Create a named Stats API key](https://handigraphs.com/account/api) and copy it when it is revealed.
3. Open Terminal and run these commands in order:

```bash
claude plugin marketplace add Handigraphs/handigraphs-stats-api-mcp
claude plugin install handigraphs-stats-api@handigraphs
```

4. Inside Claude Code, run `/plugin configure handigraphs-stats-api@handigraphs`, paste the key into the sensitive setting, and save it.
5. Run `/reload-plugins` or start a new Claude Code session.

### Claude Desktop extension

1. [Create a named Stats API key](https://handigraphs.com/account/api) and copy it when it is revealed.
2. Download `handigraphs-stats-api-mcp-<version>.mcpb` from the matching [GitHub release](https://github.com/Handigraphs/handigraphs-stats-api-mcp/releases).
3. Double-click the downloaded file to open it in Claude Desktop. If it does not open, drag the file onto the Claude Desktop window.
4. Review the extension, select **Install**, and enter the Stats API key when prompted.
5. Start a new conversation. Select **+** in the message box, then **Connectors**, and confirm **Handigraphs Stats API** appears.

The bundle includes the compiled server and its production dependencies; a separate Node.js installation is not required by the extension.

These are local distributions. They do not create a hosted connector for Claude.ai, Claude Cowork, mobile clients, or ChatGPT web.

## Configure another MCP client

Node.js 22 or newer is required. Add the published npm package to any client that supports local stdio MCP servers:

```json
{
  "mcpServers": {
    "handigraphs-stats": {
      "command": "npx",
      "args": ["-y", "@handigraphs/stats-api-mcp"],
      "env": { "HANDIGRAPHS_API_KEY": "hg_live_REPLACE_ME" }
    }
  }
}
```

Restart the MCP client after saving its configuration. Do not commit the configuration when it contains a real key.

For sandbox testing, also set `HANDIGRAPHS_API_BASE_URL` to the sandbox origin's `/api/v1` path and use a sandbox key.

## Configuration

Environment variables:

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `HANDIGRAPHS_API_KEY` | Yes | none | Bearer key for protected data. It is never accepted as a tool argument. |
| `HANDIGRAPHS_API_BASE_URL` | No | `https://handigraphs.com/api/v1` | API v1 root. HTTPS is mandatory except loopback HTTP used by tests. |
| `HANDIGRAPHS_DISCOVERY_TTL_SECONDS` | No | `300` | In-process public-discovery cache TTL. |
| `HANDIGRAPHS_HTTP_TIMEOUT_MS` | No | `10000` | Upstream request timeout. |
| `HANDIGRAPHS_MAX_RESPONSE_BYTES` | No | `5242880` | Maximum declared or streamed upstream JSON response size. |

## Query model

`query_stats` accepts `sport`, `resource`, and these optional fields: `split`, `metrics`, up to five numeric `filters`, `sort`, `team`, `opponent`, `entity_id`, `day`, `page_size`, `cursor`, `stat_format`, `meta`, `category`, `duration`, and `location`. Resource discovery determines which optional fields are supported. `stat_format` and `meta` default to `compact`.

Filter objects use `{ "metric": "k_pct", "operator": "gte", "value": 0.20 }`. Operators are `eq`, `ne`, `gt`, `gte`, `lt`, and `lte`. Values must be finite and use the canonical unit returned by discovery; proportions use `0.20` for 20%.

Successful tools return the upstream JSON in `structuredContent.response`, a minified JSON text block, and safe request/quota headers in `structuredContent.metadata`. Upstream problem responses become `isError` tool results. The server does not automatically retry `429` or `503` responses.

## Security behavior

- stdout is reserved exclusively for MCP protocol messages; diagnostics use stderr.
- Authorization is sent only to protected resource URLs, never public discovery.
- Redirects, credentialed base URLs, cross-origin discovery links, and links outside `/api/v1` are rejected.
- Discovery uses a 300-second default cache with ETag revalidation and in-flight coalescing. Protected data and errors are never cached.
- Upstream JSON bodies are bounded by declared and streamed byte size before parsing.
- Error and diagnostic values recursively redact the configured key and authorization-like fields.

See [SECURITY.md](SECURITY.md) for reporting and key-handling guidance.

## Development

Clone this repository and install its locked dependencies:

```bash
npm ci
```

Run the complete local validation suite:

```bash
npm test
npm run typecheck
npm run build
npm run pack:check
npm run distributions:check
npm run mcpb:check
```

Tests use local mocked HTTP servers and the official MCP client, including an end-to-end stdio process. No live Handigraphs key or external service is required.

Build a local Claude Desktop artifact in `artifacts/` with:

```bash
npm run mcpb:pack
```

## License

Licensed under the [Apache License 2.0](LICENSE).
