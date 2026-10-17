# Security

## Reporting a vulnerability

Do not open a public issue containing credentials, exploit details, subscriber data, or sensitive logs. Use this repository's **Security** tab to submit a private vulnerability report. If private reporting is unavailable, contact the Handigraphs maintainers through the support channel at [www.handigraphs.com](https://www.handigraphs.com).

## API key handling

- Supply the key through `HANDIGRAPHS_API_KEY` in the MCP process environment, or use the Codex plugin's macOS helper to store it in the user's login Keychain.
- Never put a real key in tool arguments, source files, committed MCP configuration, screenshots, or support logs.
- When the Codex plugin has no key, its setup workflow never receives the key. Windows launches the bundled masked helper through Codex's user-approved local-shell path; macOS uses the argument-free `configure_api_key` tool to launch its helper.
- The Windows helper accepts the key only in a password-masked local dialog, never prints it or places it on a command line, and saves it as the current user's `HANDIGRAPHS_API_KEY` environment variable.
- The macOS helper accepts the key only in a password-masked local dialog, passes it to Apple's `security` utility through a private stdin pipe, and saves it as a generic password in the user's login Keychain. The key is never placed in process arguments, shell history, or a file.
- On macOS the MCP runtime reads only the named Handigraphs Keychain item when `HANDIGRAPHS_API_KEY` is absent. Environment configuration takes precedence when explicitly supplied.
- The server sends the key only as a Bearer credential to same-origin protected paths under the configured `/api/v1` root.
- Public discovery requests never receive Authorization.
- Rotate or revoke a key immediately from `/account/api` if exposure is suspected.

The package recursively redacts the configured key and authorization-like fields in errors and stderr diagnostics. Redaction is defense in depth, not permission to log credentials.

Upstream JSON is rejected before parsing when its declared or streamed size exceeds `HANDIGRAPHS_MAX_RESPONSE_BYTES`. Keep this guard enabled to bound memory use from both successful and problem responses.

## Transport and trust boundary

The server supports stdio only. The base URL must use HTTPS; plain HTTP is accepted only for a loopback hostname to support local tests. Redirects are not followed. Credentialed URLs, cross-origin links, and discovery links outside `/api/v1` are rejected.

Do not weaken these controls to accommodate a proxy. Configure a trusted same-origin HTTPS endpoint instead.

## Account actions and research

The server now includes account mutations. Tool annotations mark saves, replacements,
research submission and cancellation as writes; reads and live filter evaluation
remain read-only. The API enforces ownership, eligibility, scopes and rollout gates.
New and existing eligible keys default to filter-writing and research permissions,
which owners can disable. A permission is not confirmation of an agent's proposed action.

New saves require explicit user intent. Replacements require confirmation and a
current revision, with conflicts surfaced instead of silently overwriting or creating
copies. Creates and submissions use an operation UUID for idempotency. Keep the same
UUID and exact body after an uncertain response; generating another can duplicate work.
Cancellation is an explicit bodyless POST and reports its actual state.

Operations use pinned methods and route templates advertised by discovery. The tools
offer no generic HTTP request, hosted transport, bet placement or tracking mutation.
Request/response sizes are bounded; retries and polling are not automatic. Private
responses remain uncached, and report expiry is preserved.

Treat Gamecenter narratives, saved names and other returned content as untrusted data,
not instructions to call tools or change permissions. Never expose a key in results or
audit artifacts. The agent sandbox audit is read-only; live mutating acceptance needs
a separately verified synthetic account and explicit test authorization.
