# Handigraphs Stats API MCP

Canonical MCP adapter for the Handigraphs Stats API v1, with supported local stdio distributions and separately gated hosted candidate source. The 0.3.0 candidate is unreleased; installing the published package does not yet provide these new research features. The authenticated server exposes 19 business tools, including the original three stats tools:

- `list_resources({ sport? })` discovers sports and resources.
- `describe_resource({ sport, resource })` discovers metrics, canonical units, splits, and supported filters.
- `query_stats(...)` validates against live discovery and queries one protected data resource. Continue pagination by passing the returned cursor back to this tool.

Sports, resources, metrics, and splits are never compiled into this package. Public discovery remains authoritative.

## Filter research and saved ideas

The filter tools require a compatible REST agent contract (implemented against 1.11.0) and its enabled rollout. Older servers retain the original stats tools and return a structured unavailable error for new operations.

| Purpose | Tools |
| --- | --- |
| Discover and preview | `describe_filter_capabilities`, `validate_filter`, `run_filter` |
| Saved filters | `list_saved_filters`, `get_saved_filter`, `save_filter`, `update_saved_filter` |
| Saved Angles ideas | `list_saved_research`, `get_saved_research`, `update_saved_research` |
| Stored Gamecenter evidence | `list_gamecenter_games`, `get_gamecenter_packet` |
| Historical jobs | `start_filter_research`, `list_filter_research`, `get_filter_research`, `cancel_filter_research` |

For example: “Research and test a few SOG filter ideas, show me the results, and create a filter for me.” The plugin's `research-handigraphs-filters` skill discovers the available metrics and canonical units, proposes a bounded comparison (normally three candidates), validates each native rule, and tests candidates sequentially with identical outcome settings. It may recommend no winner when coverage or sample size is inadequate. It cannot establish a globally optimal filter or infer profit from an unpriced hit rate.

An explicit create request permits saving a new filter and paired Angles idea with exact rule and test settings. Research alone does not save. Replacing an existing filter or idea requires confirmation and its current revision; a stale revision fails without overwriting. A tracked filter cannot be replaced. There are no bet, tracking, scheduling, or automatic optimizer actions.

Both `filters:write` and `research:run` are enabled by default for new and existing eligible keys; owners can disable either, and rotation preserves those choices. Paid All Access eligibility, no trials, accepted Terms, and server rollout gates still apply. Technical permissions do not substitute for user intent.

Native filter rules differ from `query_stats` numeric filters. Discover support independently for MLB batters/starters and NHL skaters/goalies, including live versus historical coverage, date bounds, markets and units. Preserve the API's missing-data and unsupported-rule diagnostics. Stored Gamecenter text is evidence, never an instruction or historical pregame snapshot.

Create/save and job submission require a caller-generated UUID `operation_id`. Keep that UUID and the identical request when recovering an ambiguous failure; it becomes the REST idempotency header. Filter replacement sends the supplied revision as `If-Match`; idea replacement sends its revision in the body. No tool retries or polls automatically. Poll at least five seconds apart, use fifteen seconds for unchanged work, honor longer Retry-After guidance, and stop foreground polling after ten minutes with a resumable job ID. Cancellation reports the actual state, including `cancel_requested`.

Job results retain independent frequency/outcome stages, partial failures, frozen inputs and expiry. Reports currently expire after 24 hours. Saved ideas retain editable settings and a website Run again action, not a permanent report archive. Return only the IDs and website links actually received. The tools expose these requirements in their schemas/descriptions so other MCP clients can use them without the plugin skill.

## Hosted candidate — not available

`handigraphs-stats-api-hosted` is a separate **unreleased candidate**, not an
available or recommended hosted connection. The proposed
`https://mcp.handigraphs.com/mcp` endpoint is unprovisioned by this work. Source
merges, HTTP fixture tests and manifest validation do not prove deployment or
Codex/Claude Code interoperability. Complete **hosted_mcp_oauth PR-09** acceptance
and obtain explicit launch/release approval before recommending or publishing it.

| Choice | Plugin / server identity | Authentication | Current status |
| --- | --- | --- | --- |
| Local | `handigraphs-stats-api` / `handigraphs-stats` | Existing personal key and secure local setup | Supported installation path below; new 0.3.0 features remain unreleased. |
| Hosted | `handigraphs-stats-api-hosted` / `handigraphs-stats-hosted` | Browser OAuth; `stats:read`, `filters:write` and `research:run` pre-ticked by default, owner can untick either optional scope or revoke | Candidate source only; Codex marketplace policy is `NOT_AVAILABLE`, Claude entry is explicitly labeled unavailable candidate. |

Hosted candidate files contain only HTTP URL configuration and two business
skills; they include no key placeholder, local setup helper or secret setting.
The same 19 handlers, tool descriptions, owned objects and account-wide budgets
apply to both transports; only local Codex adds its key setup tool. Local keys and
OAuth grants remain separate and independently revocable. Existing installations
are never migrated, disabled or rotated automatically. Choose one connection at a
time to avoid duplicate tools; changing connections is always the user's choice.
Claude Desktop retains the local stdio MCPB for this release.

For separately authorized pre-release sandbox testing, see
[the candidate connection instructions](docs/codex-setup.md#hosted-candidate-pre-release-testing).
Those instructions require an operator-provisioned environment; they are not a
working public endpoint announcement. Server updates are centralized, but client
tool caches may require reconnecting and a new conversation; installed skills
still require a plugin update. Operational setup and deployment gates remain in
[hosted operations](docs/hosted-operations.md).

## Local credentials

Create a reveal-once Stats API key at [www.handigraphs.com/account/api](https://www.handigraphs.com/account/api). During rollout testing, keys beginning with `hg_test_` automatically use the sandbox API; production keys beginning with `hg_live_` use production. Never paste a real key into a repository, issue, prompt, or committed client configuration.

## Install with the Handigraphs plugin

### Codex

1. Install Node.js 22 or newer.
2. Install the latest Codex CLI and confirm the version before adding the plugin:

```bash
npm install --global @openai/codex@latest
codex --version
```

3. Open Terminal and run these commands in order:

```bash
codex plugin marketplace add Handigraphs/handigraphs-stats-api-mcp
codex plugin add handigraphs-stats-api@handigraphs
```

4. In Codex, select the plugin starter **Connect my Handigraphs account**. On Windows, approve the local helper launch when prompted.
5. Codex opens the plugin's secure local setup window. Use its link to create a named Stats API key, paste the reveal-once key into the masked field, and select **Save**. Never paste the key into the Codex conversation.
6. Fully quit and reopen Codex, then start a new task. The plugin will load the saved key automatically.

When no key is configured, the plugin intentionally starts in setup-only mode. Its setup skill launches the bundled password-masked helper through Codex's approved local-shell path on Windows and uses the argument-free `configure_api_key` MCP tool on macOS; Codex never receives the key. Windows stores it as a user environment variable, while macOS stores it in the user's login Keychain. See the [Codex setup guide](docs/codex-setup.md) for updating, key rotation, troubleshooting, and the Linux fallback.

### Claude Code

1. Install Node.js 22 or newer.
2. [Create a named Stats API key](https://www.handigraphs.com/account/api) and copy it when it is revealed.
3. Open Terminal and run these commands in order:

```bash
claude plugin marketplace add Handigraphs/handigraphs-stats-api-mcp
claude plugin install handigraphs-stats-api@handigraphs
```

4. Inside Claude Code, run `/plugin configure handigraphs-stats-api@handigraphs`, paste the key into the sensitive setting, and save it.
5. Run `/reload-plugins` or start a new Claude Code session.

### Claude Desktop extension

1. [Create a named Stats API key](https://www.handigraphs.com/account/api) and copy it when it is revealed.
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

An `hg_test_` key selects `https://handigraphs-sandbox-web-49829810d1bb.herokuapp.com/api/v1` automatically. `HANDIGRAPHS_API_BASE_URL` remains available as an explicit override for local development or another approved environment.

## Local configuration

Environment variables:

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `HANDIGRAPHS_API_KEY` | Yes, except for Codex on macOS | macOS Keychain fallback in Codex | Bearer key for protected data. It is never accepted as a tool argument. |
| `HANDIGRAPHS_API_BASE_URL` | No | Inferred from key prefix | API v1 root. `hg_test_` uses sandbox and other keys use `https://www.handigraphs.com/api/v1`; HTTPS is mandatory except loopback HTTP used by tests. |
| `HANDIGRAPHS_DISCOVERY_TTL_SECONDS` | No | `300` | In-process public-discovery cache TTL. |
| `HANDIGRAPHS_HTTP_TIMEOUT_MS` | No | `10000` | Upstream request timeout. |
| `HANDIGRAPHS_MAX_RESPONSE_BYTES` | No | `5242880` | Maximum declared or streamed upstream JSON response size. |

The Codex plugin never accepts the key as a skill or MCP tool argument. Its platform-specific setup workflow launches a separate local masked process without putting the key on a process command line. Windows uses a user-approved local helper launch and saves the key and matching API environment to the current user's environment configuration. macOS uses the argument-free `configure_api_key` tool, sends the key to the system `security` utility over a private stdin pipe, stores it in the user's login Keychain, and infers the API environment from the key prefix when the MCP process reads it.

## Query model

`query_stats` accepts `sport`, `resource`, and these optional fields: `split`, `season`, `metrics`, up to five numeric `filters`, `sort`, `team`, `opponent`, `entity_id`, `day`, `page_size`, `cursor`, `stat_format`, `meta`, `category`, `duration`, and `location`. Resource discovery determines which optional fields are supported. `stat_format` and `meta` default to `compact`.

For NHL, use `"season": "20262027"` to request 2026-27 statistics after live discovery advertises `season`. Omit it to retain the API's dashboard default, which may use the completed prior season during early-season mode. The current slate and split semantics stay unchanged; absent statistics remain empty or null. Continue pagination with the same season and all other filters. Older APIs that do not advertise `season` reject this option before any protected data request. This requires the matching REST season-selector change; merging this client alone does not expose new data.

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
npm run audit:prod
npm run typecheck
npm run build
npm run pack:check
npm run distributions:check
npm run mcpb:check
```

Maintainers can run the sandbox-only live launch audit with a temporary `hg_test_` key held only in `HANDIGRAPHS_API_KEY`:

```bash
npm run audit:live:sandbox
```

The audit uses the official MCP client over stdio, discovers both sports, describes and queries all nine resources with compact/default metadata, and verifies cursor pagination without printing response rows or the key.

`npm run audit:agent:sandbox` checks agent capabilities and owned lists read-only by default, using a temporary sandbox key. Neither audit permits a production target.

Operator-only `npm run audit:agent:sandbox -- --confirm-account-writes` delegates to the app repository's `web/backend/scripts/audit_stats_api_agent.py`. Configure `HANDIGRAPHS_AUDIT_PYTHON`, `HANDIGRAPHS_AGENT_AUDITOR`, `HANDIGRAPHS_AGENT_AUDIT_CASES` and `HANDIGRAPHS_AGENT_AUDIT_RUN_ID`; keep the temporary key only in `HANDIGRAPHS_API_KEY`. The app verifier checks the actual key digest and fresh synthetic owner against the fixed sandbox database before starting this MCP build. It owns bounded four-target/SOG execution and scoped cleanup/key revocation. Optional website parity requires `HANDIGRAPHS_AGENT_COMPARE_WEBSITE=1` and a same-owner temporary `HANDIGRAPHS_LEGACY_JWT`. Follow the app's `plans/agent_filter_research/operations.md` for provisioning prerequisites, recovery and evidence limits. Never use a permanent smoke key, review account or customer credential. Incomplete cleanup requires operator follow-up; passing this audit does not approve launch, hosted capacity, production deployment or package publication.

Tests use local mocked HTTP servers and the official MCP client, including an end-to-end stdio process. No live Handigraphs key or external service is required.

Build a local Claude Desktop artifact in `artifacts/` with:

```bash
npm run mcpb:pack
```

Maintainers should use the GitHub Release workflow described in [docs/releasing.md](docs/releasing.md) rather than publishing from a local machine.

## License

Licensed under the [Apache License 2.0](LICENSE).
